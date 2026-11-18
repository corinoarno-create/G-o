// Préparation d'une manche : base, planificateur FSRS, enregistreur et choix des éléments.
import type { WorldData } from '../data/world.ts';
import { createSrs, type Srs } from '../engine/srs.ts';
import { detectDevice } from '../lib/device.ts';
import type { Zone } from '../map/zones.ts';
import { getAllCards, getSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { CardRecord } from '../storage/schema.ts';
import { EXERCISES, type ExerciseId } from './exercises.ts';
import { AnswerRecorder } from './recorder.ts';
import { selectItems, type ContentType } from './selection.ts';

export interface GameConfig {
  exercise: ExerciseId;
  zone: Zone;
  count: number | 'all';
  content: ContentType;
  /** Éléments imposés (ex. « Revoir ces éléments ») ; sinon choisis selon le type de contenu. */
  items?: string[];
}

export interface PreparedGame {
  config: GameConfig;
  items: string[];
  recorder: AnswerRecorder;
  /** Autocomplétion en saisie (réglage mémorisé). */
  autocomplete: boolean;
}

let srs: Promise<Srs> | null = null;
const getSrs = () => (srs ??= createSrs());

/** Entités de la zone qui peuvent être demandées dans cet exercice. */
export function eligibleIds(world: WorldData, exercise: ExerciseId, zone: Zone): string[] {
  const definition = EXERCISES[exercise];
  return zone.entityIds.filter((id) => {
    const entity = world.byId.get(id);
    return entity !== undefined && definition.eligible(entity);
  });
}

/** Toutes les cartes mémoire enregistrées, par clé. */
export async function loadCards(): Promise<Map<string, CardRecord>> {
  const cards = await getAllCards(await progressDb());
  return new Map(cards.map((record) => [record.key, record]));
}

export async function prepareGame(world: WorldData, config: GameConfig): Promise<PreparedGame> {
  const db = await progressDb();
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const recorder = await AnswerRecorder.create(db, await getSrs(), detectDevice(), sessionId);
  const eligible = eligibleIds(world, config.exercise, config.zone);
  const items =
    config.items?.filter((id) => eligible.includes(id)) ??
    selectItems(eligible, EXERCISES[config.exercise].skill, recorder.cards, config, new Date());
  const autocomplete = await getSetting(db, 'autocomplete', false);
  return { config, items, recorder, autocomplete };
}
