// Préparation d'une manche : base, planificateur FSRS, enregistreur et choix des éléments.
import type { WorldData } from '../data/world.ts';
import { createSrs, type Srs } from '../engine/srs.ts';
import { detectDevice } from '../lib/device.ts';
import type { Zone } from '../map/zones.ts';
import { getSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import { EXERCISES, type ExerciseId } from './exercises.ts';
import { AnswerRecorder } from './recorder.ts';
import { pickItems } from './session.ts';

export interface GameConfig {
  exercise: ExerciseId;
  zone: Zone;
  count: number | 'all';
  /** Éléments imposés (ex. « Rejouer les erreurs ») ; sinon choisis automatiquement. */
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

export async function prepareGame(world: WorldData, config: GameConfig): Promise<PreparedGame> {
  const exercise = EXERCISES[config.exercise];
  const db = await progressDb();
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const recorder = await AnswerRecorder.create(db, await getSrs(), detectDevice(), sessionId);
  const eligible = config.zone.entityIds.filter((id) => {
    const entity = world.byId.get(id);
    return entity !== undefined && exercise.eligible(entity);
  });
  const items = config.items?.filter((id) => eligible.includes(id)) ??
    pickItems(eligible, exercise.skill, recorder.cards, config.count, new Date());
  const autocomplete = await getSetting(db, 'autocomplete', false);
  return { config, items, recorder, autocomplete };
}
