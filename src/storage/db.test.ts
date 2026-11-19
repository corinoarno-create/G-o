import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  countProgress,
  deleteFavorite,
  getAllCards,
  getCard,
  getDueCards,
  getFavorites,
  getReviewsForCard,
  getSetting,
  getTiming,
  openGeoDb,
  putCard,
  putFavorite,
  putSetting,
  readSnapshot,
  recordAnswer,
  replaceSnapshot,
  resetProgress,
} from './db.ts';
import { makeCard, makeReview, uniqueDbName } from './fixtures.test-utils.ts';

const now = new Date('2026-11-18T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('cartes', () => {
  it('se relisent à l’identique, dates comprises', async () => {
    const db = await openGeoDb(uniqueDbName());
    const record = await makeCard('fr', 'name-capital', now);
    await putCard(db, record);
    const read = await getCard(db, 'fr:name-capital');
    expect(read).toEqual(record);
    expect(read!.card.dueAt).toBeInstanceOf(Date);
  });

  it('ne listent comme dues que les cartes déjà révisées dont la date est passée', async () => {
    const db = await openGeoDb(uniqueDbName());
    const old = await makeCard('fr', 'name-capital', new Date(now.getTime() - 60 * DAY)); // due depuis longtemps
    const recent = await makeCard('de', 'name-capital', now); // due dans quelques jours
    const fresh = await makeCard('it', 'name-capital', null); // neuve
    for (const record of [old, recent, fresh]) await putCard(db, record);
    expect((await getDueCards(db, now)).map((r) => r.key)).toEqual(['fr:name-capital']);
    expect(await getAllCards(db)).toHaveLength(3);
  });
});

describe('recordAnswer', () => {
  it('enregistre la réponse, la carte et le temps ensemble', async () => {
    const db = await openGeoDb(uniqueDbName());
    const card = await makeCard('fr', 'locate-country', now);
    const id = await recordAnswer(db, {
      review: makeReview('fr:locate-country', now),
      card,
      timing: { device: 'mobile', mode: 'pin', stats: { samples: [2000, 2500] } },
    });
    expect(id).toBeGreaterThan(0);
    expect(await getCard(db, 'fr:locate-country')).toEqual(card);
    expect(await getTiming(db, 'mobile', 'pin')).toEqual({ samples: [2000, 2500] });
    expect(await getTiming(db, 'desktop', 'pin')).toEqual({ samples: [] });
    const reviews = await getReviewsForCard(db, 'fr:locate-country');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.at).toEqual(now);
  });

  it('peut enregistrer une réponse sans toucher à la carte (nouvel essai dans la manche)', async () => {
    const db = await openGeoDb(uniqueDbName());
    await recordAnswer(db, { review: { ...makeReview('fr:flag', now), grade: null, firstAttempt: false } });
    expect(await getCard(db, 'fr:flag')).toBeUndefined();
    expect(await getReviewsForCard(db, 'fr:flag')).toHaveLength(1);
  });
});

describe('réglages et favoris', () => {
  it('rendent la valeur par défaut tant que rien n’est enregistré', async () => {
    const db = await openGeoDb(uniqueDbName());
    expect(await getSetting(db, 'dailyNewLimit', 10)).toBe(10);
    await putSetting(db, 'dailyNewLimit', 15);
    expect(await getSetting(db, 'dailyNewLimit', 10)).toBe(15);
  });

  it('s’ajoutent et se suppriment', async () => {
    const db = await openGeoDb(uniqueDbName());
    await putFavorite(db, { id: 'a', name: 'Villes d’Asie', config: { zone: 'asia' }, updatedAt: now });
    expect(await getFavorites(db)).toHaveLength(1);
    await deleteFavorite(db, 'a');
    expect(await getFavorites(db)).toHaveLength(0);
  });
});

describe('contenu complet', () => {
  it('se lit et se remplace en bloc', async () => {
    const source = await openGeoDb(uniqueDbName());
    await putCard(source, await makeCard('fr', 'flag', now));
    await recordAnswer(source, { review: makeReview('fr:flag', now) });
    await putSetting(source, 'theme', 'sombre');
    const snapshot = await readSnapshot(source);

    const target = await openGeoDb(uniqueDbName());
    await putCard(target, await makeCard('es', 'flag', now)); // sera effacée
    await replaceSnapshot(target, snapshot);
    const copy = await readSnapshot(target);
    expect(copy.cards.map((r) => r.key)).toEqual(['fr:flag']);
    expect(copy.reviews).toHaveLength(1);
    expect(copy.settings).toEqual([{ key: 'theme', value: 'sombre' }]);
  });
});

describe('connexion', () => {
  it('se ferme pour laisser passer une suppression de la base', async () => {
    const name = uniqueDbName();
    let closed = false;
    await openGeoDb(name, () => (closed = true));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('suppression bloquée'));
    });
    expect(closed).toBe(true);
  });
});

describe('remise à zéro', () => {
  async function seeded() {
    const db = await openGeoDb(uniqueDbName());
    for (const [entityId, skill] of [
      ['fr', 'locate-country'],
      ['fr', 'flag'],
      ['de', 'locate-country'],
      ['jp', 'name-capital'],
    ] as const) {
      const card = await makeCard(entityId, skill, now);
      await recordAnswer(db, {
        review: makeReview(card.key, now),
        card,
        timing: { device: 'desktop', mode: 'pin', stats: { samples: [2000] } },
      });
    }
    return db;
  }

  it('efface seulement les éléments d’une zone, et seulement certaines compétences si on le demande', async () => {
    const db = await seeded();
    const europe = { entityIds: new Set(['fr', 'de']) };
    expect(await countProgress(db, europe)).toEqual({ cards: 3, reviews: 3 });
    expect(await countProgress(db, { ...europe, skills: new Set(['flag'] as const) })).toEqual({ cards: 1, reviews: 1 });

    expect(await resetProgress(db, { ...europe, skills: new Set(['locate-country'] as const) })).toEqual({ cards: 2, reviews: 2 });
    expect((await getAllCards(db)).map((c) => c.key).sort()).toEqual(['fr:flag', 'jp:name-capital']);
    expect(await getReviewsForCard(db, 'fr:locate-country')).toEqual([]);
    // Les temps de référence ne dépendent pas d'une zone : ils sont gardés.
    expect((await getTiming(db, 'desktop', 'pin')).samples).toEqual([2000]);
  });

  it('efface tout, temps de référence compris, mais garde réglages et favoris', async () => {
    const db = await seeded();
    await putSetting(db, 'autocomplete', true);
    expect(await resetProgress(db, {})).toEqual({ cards: 4, reviews: 4 });
    expect(await getAllCards(db)).toEqual([]);
    expect((await getTiming(db, 'desktop', 'pin')).samples).toEqual([]);
    expect(await getSetting(db, 'autocomplete', false)).toBe(true);
  });
});
