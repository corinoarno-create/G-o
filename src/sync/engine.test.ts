import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getAllCards, getAllReviews, getSetting, getTiming, openGeoDb, putSetting, recordAnswer, resetProgress } from '../storage/db.ts';
import { makeCard, makeReview, uniqueDbName } from '../storage/fixtures.test-utils.ts';
import { REMOTE_FORMAT, shardOf, SHARD_COUNT, syncOnce, SyncFormatError, type RemoteBatch, type RemoteCore, type RemoteStore } from './engine.ts';

/** Faux coffre en ligne, en mémoire, avec une horloge de serveur qui avance à chaque écriture. */
class FakeRemote implements RemoteStore {
  core: RemoteCore = { state: null, shards: Array(SHARD_COUNT).fill(null) };
  batches: RemoteBatch[] = [];
  writes = 0;
  private clock = 1_000_000;

  async updateCore(compute: (core: RemoteCore) => { state?: string; shards: Map<number, string> }) {
    const write = compute({ state: this.core.state, shards: [...this.core.shards] });
    if (write.state !== undefined) {
      this.core.state = write.state;
      this.writes += 1;
    }
    for (const [i, text] of write.shards) {
      this.core.shards[i] = text;
      this.writes += 1;
    }
  }
  async batchesSince(ms: number) {
    return this.batches.filter((batch) => batch.createdAtMs > ms);
  }
  async addBatch(items: string) {
    this.clock += 60_000;
    this.batches.push({ createdAtMs: this.clock, items });
  }
}

/** Un appareil : sa base, et la date de sa dernière lecture du journal. */
async function device(remote: FakeRemote) {
  const db = await openGeoDb(uniqueDbName());
  let lastPull = 0;
  return {
    db,
    async sync() {
      const result = await syncOnce(db, remote, lastPull);
      lastPull = result.lastPullMs;
      return result;
    },
    async play(entityId: string, at: Date) {
      const card = await makeCard(entityId, 'flag', at);
      await recordAnswer(db, {
        review: makeReview(card.key, at),
        card,
        timing: { device: 'desktop', mode: 'choice', stats: { samples: [at.getTime() % 10_000] } },
      });
    },
  };
}

const keys = async (db: Awaited<ReturnType<typeof device>>['db']) => (await getAllCards(db)).map((r) => r.key).sort();
const day = (n: number) => new Date(`2026-11-${String(n).padStart(2, '0')}T09:00:00Z`);

describe('syncOnce', () => {
  it('fait passer ma progression du PC au téléphone', async () => {
    const remote = new FakeRemote();
    const pc = await device(remote);
    const phone = await device(remote);
    await pc.play('fr', day(18));
    await pc.play('jp', day(18));
    await putSetting(pc.db, 'autocomplete', true);

    expect(await pc.sync()).toMatchObject({ reviewsSent: 2, reviewsReceived: 0 });
    expect(await phone.sync()).toMatchObject({ cardsReceived: 2, reviewsReceived: 2, reviewsSent: 0 });
    expect(await keys(phone.db)).toEqual(['fr:flag', 'jp:flag']);
    expect(await getAllReviews(phone.db)).toHaveLength(2);
    expect(await getSetting(phone.db, 'autocomplete', false)).toBe(true);
    expect((await getTiming(phone.db, 'desktop', 'choice')).samples).toHaveLength(1);
  });

  it('réunit deux appareils qui ont joué chacun de leur côté, sans doublon', async () => {
    const remote = new FakeRemote();
    const pc = await device(remote);
    const phone = await device(remote);
    await pc.play('fr', day(18));
    await phone.play('fr', day(19)); // révision plus récente de la même carte
    await phone.play('br', day(19));

    await pc.sync();
    await phone.sync();
    await pc.sync();
    // Rien de neuf : une nouvelle synchronisation n'envoie rien et n'écrit rien.
    const writes = remote.writes;
    expect(await pc.sync()).toMatchObject({ reviewsSent: 0, reviewsReceived: 0, cardsReceived: 0 });
    expect(await phone.sync()).toMatchObject({ reviewsSent: 0, reviewsReceived: 0, cardsReceived: 0 });
    expect(remote.writes).toBe(writes);

    for (const d of [pc, phone]) {
      expect(await keys(d.db)).toEqual(['br:flag', 'fr:flag']);
      const fr = (await getAllCards(d.db)).find((r) => r.key === 'fr:flag')!;
      expect(fr.card.lastReviewAt).toEqual(day(19));
      expect(await getAllReviews(d.db)).toHaveLength(3);
    }
    expect(remote.batches.flatMap((b) => JSON.parse(b.items) as unknown[])).toHaveLength(3);
  });

  it('reconnaît les réponses déjà en ligne (arrivées avant par un fichier JSON) au lieu de les renvoyer', async () => {
    const remote = new FakeRemote();
    const pc = await device(remote);
    const phone = await device(remote);
    await pc.play('fr', day(18));
    await phone.play('fr', day(18)); // la même réponse, importée autrefois par fichier
    await pc.sync();
    expect(await phone.sync()).toMatchObject({ reviewsSent: 0, reviewsReceived: 0 });
    expect(await getAllReviews(phone.db)).toHaveLength(1);
  });

  it('fait suivre une remise à zéro, sans que l’autre appareil renvoie ce qui a été effacé', async () => {
    const remote = new FakeRemote();
    const pc = await device(remote);
    const phone = await device(remote);
    await pc.play('fr', day(18));
    await pc.play('jp', day(18));
    await pc.sync();
    await phone.sync();

    await resetProgress(phone.db, { entityIds: new Set(['fr']) }, day(19));
    await pc.sync(); // le PC a encore la France : il ne doit pas la renvoyer comme neuve
    await phone.sync();
    await pc.sync();

    for (const d of [pc, phone]) {
      expect(await keys(d.db)).toEqual(['jp:flag']);
      expect((await getAllReviews(d.db)).map((r) => r.cardKey)).toEqual(['jp:flag']);
    }
    // Rejouée après la remise à zéro, la France revient normalement.
    await pc.play('fr', day(20));
    await pc.sync();
    await phone.sync();
    expect(await keys(phone.db)).toEqual(['fr:flag', 'jp:flag']);
  });

  it('range chaque carte toujours dans le même paquet', () => {
    expect(shardOf('fr:flag')).toBe(shardOf('fr:flag'));
    const used = new Set(['fr', 'de', 'jp', 'br', 'us', 'cn', 'in', 'ng', 'au', 'ca'].map((id) => shardOf(`${id}:flag`)));
    expect(used.size).toBeGreaterThan(4);
    for (const i of used) expect(i).toBeLessThan(SHARD_COUNT);
  });

  it('refuse des données en ligne d’une version plus récente de l’app', async () => {
    const remote = new FakeRemote();
    remote.core.state = JSON.stringify({ format: REMOTE_FORMAT + 1 });
    const pc = await device(remote);
    await expect(pc.sync()).rejects.toBeInstanceOf(SyncFormatError);
  });

  it('n’écrase pas une carte locale plus récente que celle reçue', async () => {
    const remote = new FakeRemote();
    const pc = await device(remote);
    const phone = await device(remote);
    await pc.play('fr', day(18));
    await pc.sync();
    await phone.db.put('cards', await makeCard('fr', 'flag', day(20)));
    await phone.sync();
    const fr = (await getAllCards(phone.db))[0]!;
    expect(fr.card.lastReviewAt).toEqual(day(20));
  });
});
