import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_VERSION,
  backupFileName,
  BackupError,
  exportBackup,
  importBackup,
  mergeSnapshots,
  parseBackup,
  serializeBackup,
} from './backup.ts';
import { openGeoDb, putCard, readSnapshot, recordAnswer } from './db.ts';
import { makeCard, makeReview, uniqueDbName } from './fixtures.test-utils.ts';
import { emptySnapshot, type ProgressSnapshot } from './schema.ts';

const now = new Date('2026-11-18T09:00:00Z');
const later = new Date('2026-11-20T09:00:00Z');

async function sampleSnapshot(): Promise<ProgressSnapshot> {
  return {
    cards: [await makeCard('fr', 'name-capital', now), await makeCard('jp', 'flag', null)],
    reviews: [{ ...makeReview('fr:name-capital', now), id: 7 }],
    timing: [{ key: 'desktop:pin', samples: [2100, 2400] }],
    settings: [{ key: 'dailyNewLimit', value: 12 }],
    favorites: [{ id: 'f1', name: 'Capitales d’Asie', config: { zone: 'asia' }, updatedAt: now }],
    resets: [],
  };
}

describe('serializeBackup / parseBackup', () => {
  it('retrouvent le même contenu, dates comprises', async () => {
    const snapshot = await sampleSnapshot();
    const parsed = parseBackup(serializeBackup(snapshot, now));
    const { id: _ignored, ...review } = snapshot.reviews[0]!;
    expect(parsed).toEqual({ ...snapshot, reviews: [review] });
    expect(parsed.cards[0]!.card.dueAt).toBeInstanceOf(Date);
    expect(parsed.cards[1]!.card.lastReviewAt).toBeNull();
  });

  it('indiquent le format et la version', async () => {
    const file = JSON.parse(serializeBackup(emptySnapshot(), now));
    expect(file).toMatchObject({ format: 'geo-progression', version: BACKUP_VERSION, exportedAt: now.toISOString() });
  });

  it('refusent clairement un fichier qui n’est pas une sauvegarde', () => {
    expect(() => parseBackup('pas du json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"autre"}')).toThrow(/sauvegarde de progression/);
    expect(() => parseBackup('{"format":"geo-progression","version":99,"data":{}}')).toThrow(/plus récente/);
    expect(() => parseBackup('{"format":"geo-progression","version":1,"data":{"cards":[{"key":"fr:flag"}]}}')).toThrow(
      /carte n° 1/,
    );
    expect(() =>
      parseBackup(
        '{"format":"geo-progression","version":1,"data":{"reviews":[{"cardKey":"fr:flag","at":"hier"}]}}',
      ),
    ).toThrow(/Date invalide/);
  });
});

describe('mergeSnapshots', () => {
  it('garde la carte révisée le plus récemment et ajoute les nouvelles', async () => {
    const local = { ...emptySnapshot(), cards: [await makeCard('fr', 'flag', now), await makeCard('de', 'flag', later)] };
    const incoming = {
      ...emptySnapshot(),
      cards: [
        await makeCard('fr', 'flag', later, 'easy'), // plus récente : remplace
        await makeCard('de', 'flag', now), // plus ancienne : ignorée
        await makeCard('it', 'flag', now), // absente : ajoutée
      ],
    };
    const { snapshot, summary } = mergeSnapshots(local, incoming);
    expect(summary).toEqual({ cardsAdded: 1, cardsUpdated: 1, reviewsAdded: 0 });
    const byKey = new Map(snapshot.cards.map((r) => [r.key, r]));
    expect(byKey.get('fr:flag')!.card.lastReviewAt).toEqual(later);
    expect(byKey.get('de:flag')!.card.lastReviewAt).toEqual(later);
    expect(byKey.has('it:flag')).toBe(true);
  });

  it('réunit les journaux sans doublon, dans l’ordre chronologique', () => {
    const shared = makeReview('fr:flag', now);
    const { snapshot, summary } = mergeSnapshots(
      { ...emptySnapshot(), reviews: [shared, makeReview('fr:flag', later)] },
      { ...emptySnapshot(), reviews: [shared, makeReview('de:flag', new Date('2026-11-19T09:00:00Z'))] },
    );
    expect(summary.reviewsAdded).toBe(1);
    expect(snapshot.reviews.map((r) => r.cardKey)).toEqual(['fr:flag', 'de:flag', 'fr:flag']);
  });

  it('garde les temps et réglages d’ici, et le favori le plus récent', () => {
    const { snapshot } = mergeSnapshots(
      {
        ...emptySnapshot(),
        timing: [{ key: 'desktop:pin', samples: [1] }],
        settings: [{ key: 'a', value: 1 }],
        favorites: [{ id: 'f', name: 'ancien', config: null, updatedAt: now }],
      },
      {
        ...emptySnapshot(),
        timing: [
          { key: 'desktop:pin', samples: [9] },
          { key: 'mobile:pin', samples: [3] },
        ],
        settings: [{ key: 'a', value: 2 }],
        favorites: [{ id: 'f', name: 'nouveau', config: null, updatedAt: later }],
      },
    );
    expect(snapshot.timing).toEqual([
      { key: 'desktop:pin', samples: [1] },
      { key: 'mobile:pin', samples: [3] },
    ]);
    expect(snapshot.settings).toEqual([{ key: 'a', value: 1 }]);
    expect(snapshot.favorites[0]!.name).toBe('nouveau');
  });
});

describe('exportBackup / importBackup', () => {
  it('font passer la progression d’un appareil à l’autre en fusionnant', async () => {
    const pc = await openGeoDb(uniqueDbName());
    await putCard(pc, await makeCard('fr', 'flag', later));
    await recordAnswer(pc, { review: makeReview('fr:flag', later) });
    const { fileName, text } = await exportBackup(pc, later);
    expect(fileName).toBe('geo-progression-2026-11-20.json');

    const phone = await openGeoDb(uniqueDbName());
    await putCard(phone, await makeCard('jp', 'flag', now));
    const summary = await importBackup(phone, text);
    expect(summary).toEqual({ cardsAdded: 1, cardsUpdated: 0, reviewsAdded: 1 });
    const merged = await readSnapshot(phone);
    expect(merged.cards.map((r) => r.key).sort()).toEqual(['fr:flag', 'jp:flag']);
  });

  it('peuvent remplacer entièrement la progression', async () => {
    const source = await openGeoDb(uniqueDbName());
    await putCard(source, await makeCard('fr', 'flag', now));
    const { text } = await exportBackup(source, now);
    const target = await openGeoDb(uniqueDbName());
    await putCard(target, await makeCard('jp', 'flag', now));
    await importBackup(target, text, 'replace');
    expect((await readSnapshot(target)).cards.map((r) => r.key)).toEqual(['fr:flag']);
  });

  it('ne touchent à rien si le fichier est invalide', async () => {
    const db = await openGeoDb(uniqueDbName());
    await putCard(db, await makeCard('jp', 'flag', now));
    await expect(importBackup(db, '{"format":"autre"}', 'replace')).rejects.toThrow(BackupError);
    expect((await readSnapshot(db)).cards).toHaveLength(1);
  });
});

describe('backupFileName', () => {
  it('contient la date du jour', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('geo-progression-2026-01-05.json');
  });
});

describe('mergeSnapshots : synchronisation entre appareils', () => {
  const reset = (at: Date, entityIds?: string[]) => ({ id: `r-${at.getTime()}`, at, ...(entityIds && { entityIds }) });

  it('applique une remise à zéro venue d’ailleurs à ce qui date d’avant elle, pas après', async () => {
    const between = new Date('2026-11-19T09:00:00Z');
    const local = {
      ...emptySnapshot(),
      cards: [await makeCard('fr', 'flag', now), await makeCard('de', 'flag', later), await makeCard('jp', 'flag', now)],
      reviews: [makeReview('fr:flag', now), makeReview('de:flag', later), makeReview('jp:flag', now)],
    };
    // L'autre appareil a effacé l'Europe le 19 : la France (révisée le 18) part, l'Allemagne (le 20) reste.
    const incoming = { ...emptySnapshot(), resets: [reset(between, ['fr', 'de'])] };
    const { snapshot } = mergeSnapshots(local, incoming);
    expect(snapshot.cards.map((r) => r.key).sort()).toEqual(['de:flag', 'jp:flag']);
    expect(snapshot.reviews.map((r) => r.cardKey).sort()).toEqual(['de:flag', 'jp:flag']);
    expect(snapshot.resets).toHaveLength(1);
  });

  it('ne laisse pas l’autre appareil renvoyer ce qui a été effacé ici', async () => {
    const between = new Date('2026-11-19T09:00:00Z');
    const local = { ...emptySnapshot(), resets: [reset(between)] };
    const incoming = {
      ...emptySnapshot(),
      cards: [await makeCard('fr', 'flag', now)],
      reviews: [makeReview('fr:flag', now)],
      timing: [{ key: 'desktop:pin', samples: [9], updatedAt: now.getTime() }],
    };
    const { snapshot, summary } = mergeSnapshots(local, incoming);
    expect(snapshot.cards).toEqual([]);
    expect(snapshot.reviews).toEqual([]);
    // Une remise à zéro complète efface aussi les temps de référence plus anciens.
    expect(snapshot.timing).toEqual([]);
    expect(summary).toEqual({ cardsAdded: 0, cardsUpdated: 0, reviewsAdded: 0 });
  });

  it('garde le réglage et les temps modifiés le plus récemment, d’un côté comme de l’autre', () => {
    const { snapshot } = mergeSnapshots(
      {
        ...emptySnapshot(),
        settings: [
          { key: 'a', value: 'ici', updatedAt: 2 },
          { key: 'b', value: 'ici', updatedAt: 1 },
        ],
        timing: [{ key: 'mobile:pin', samples: [1], updatedAt: 1 }],
      },
      {
        ...emptySnapshot(),
        settings: [
          { key: 'a', value: 'là-bas', updatedAt: 1 },
          { key: 'b', value: 'là-bas', updatedAt: 3 },
        ],
        timing: [{ key: 'mobile:pin', samples: [9], updatedAt: 5 }],
      },
    );
    expect(Object.fromEntries(snapshot.settings.map((r) => [r.key, r.value]))).toEqual({ a: 'ici', b: 'là-bas' });
    expect(snapshot.timing[0]!.samples).toEqual([9]);
  });

  it('donne le même résultat dans les deux sens', async () => {
    const a = { ...emptySnapshot(), cards: [await makeCard('fr', 'flag', later)], resets: [reset(now, ['de'])] };
    const b = { ...emptySnapshot(), cards: [await makeCard('fr', 'flag', now), await makeCard('de', 'flag', now)] };
    const keys = (s: ProgressSnapshot) => s.cards.map((r) => `${r.key}@${r.card.lastReviewAt?.toISOString()}`).sort();
    expect(keys(mergeSnapshots(a, b).snapshot)).toEqual(keys(mergeSnapshots(b, a).snapshot));
  });

  it('exporte et relit les remises à zéro, sans le drapeau de synchronisation', () => {
    const snapshot = {
      ...emptySnapshot(),
      reviews: [{ ...makeReview('fr:flag', now), pushed: true as const }],
      resets: [{ id: 'r1', at: now, skills: ['flag' as const] }],
    };
    const copy = parseBackup(serializeBackup(snapshot, now));
    expect(copy.resets).toEqual(snapshot.resets);
    expect(copy.reviews[0]!.pushed).toBeUndefined();
  });
});
