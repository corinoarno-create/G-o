// Logique d'une manche, sans affichage : propositions de drapeaux,
// évaluation des réponses (avec des messages positifs) et bilan de fin de manche.
import type { CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { judgeAreaPin, judgePointPin, type PinCloseness } from '../engine/geo.ts';
import type { AnswerMode } from '../engine/grading.ts';
import type { MasteryLevel } from '../engine/srs.ts';
import { matchAnswer, normalize } from '../engine/text-match.ts';
import { capitalAnswers, countryAnswers, rivalAnswers, type ExerciseId } from './exercises.ts';
import type { QuestionRef } from './questions.ts';
import { shuffle, type Rng } from './selection.ts';

/**
 * Quatre drapeaux à proposer : le bon et trois autres, de préférence de la même sous-région
 * (les drapeaux voisins se ressemblent souvent), sinon du même continent.
 */
export function buildFlagChoices(entity: CountryEntity, pool: CountryEntity[], rng: Rng = Math.random, count = 4): string[] {
  const others = shuffle(
    pool.filter((other) => other.id !== entity.id),
    rng,
  );
  const ranked = [
    ...others.filter((o) => o.subregion === entity.subregion),
    ...others.filter((o) => o.subregion !== entity.subregion && o.continent === entity.continent),
    ...others.filter((o) => o.continent !== entity.continent),
  ];
  return shuffle([entity.id, ...ranked.slice(0, count - 1).map((o) => o.id)], rng);
}

export type AnswerInput =
  | { kind: 'pin'; entityId: string | null; lonLat: [number, number] | null }
  | { kind: 'type'; text: string }
  | { kind: 'choice'; entityId: string };

export interface Evaluation {
  correct: boolean;
  /** Façon dont on a répondu (pour les temps de référence). */
  mode: AnswerMode;
  /** Bonne réponse, telle qu'on l'affiche. */
  expected: string;
  /** Bonne réponse avec son contexte (« Lima (Pérou) »), affichée sous le message après une erreur. */
  answerLabel: string;
  /**
   * Message affiché, toujours bienveillant. Les noms de pays sont cités sans article (« Tu as touché :
   * Venezuela »), car les données ne disent pas s'il faut « le », « la », « les » ou « l' ».
   */
  message: string;
  closeness?: PinCloseness;
  distanceKm?: number;
  /** Entité cliquée ou choisie, quand ce n'est pas la bonne. */
  chosenEntityId?: string | null;
  typed?: string;
  /** Longueur du nom attendu (pour corriger le temps de saisie). */
  answerLength?: number;
}

const PRAISES = ['Bravo !', 'Exact !', 'Parfait !', 'Bien vu !', 'Excellent !'];

const formatKm = (km: number) => `${Math.round(km).toLocaleString('fr-FR')} km`;

/** Évalue une réponse. */
export function evaluateAnswer(
  exercise: ExerciseId,
  entity: CountryEntity,
  input: AnswerInput,
  world: WorldData,
  rng: Rng = Math.random,
): Evaluation {
  const praise = PRAISES[Math.floor(rng() * PRAISES.length)]!;
  const nameOf = (id: string | null | undefined) => (id ? (world.byId.get(id)?.name ?? null) : null);

  // Réponse par clic sur un pays (Placer les pays, ou Drapeau → pays par la carte).
  if (input.kind === 'pin' && exercise !== 'locate-capital') {
    const result = judgeAreaPin(input.entityId, entity.id, input.lonLat, world.shapes.get(entity.id));
    const clicked = nameOf(input.entityId);
    let message = praise;
    if (!result.correct) {
      if (clicked && result.closeness === 'near') message = `Presque ! Tu as touché : ${clicked} (juste à côté).`;
      else if (clicked) message = `Tu as touché : ${clicked}.`;
      else message = 'Voici la bonne réponse.';
    }
    return {
      correct: result.correct,
      mode: 'pin',
      expected: entity.name,
      answerLabel: entity.name,
      message,
      closeness: result.closeness,
      distanceKm: result.distanceKm,
      chosenEntityId: input.entityId,
    };
  }

  // Placer une capitale : distance au point exact.
  if (input.kind === 'pin') {
    const capital = entity.capital!;
    const answerLabel = `${capital.name} (${entity.name})`;
    if (!input.lonLat) {
      return { correct: false, mode: 'pin', expected: capital.name, answerLabel, message: 'Voici la bonne réponse.' };
    }
    const result = judgePointPin(input.lonLat, [capital.lon, capital.lat], entity.areaKm2);
    const distance = formatKm(result.distanceKm);
    const message = result.correct
      ? result.distanceKm < 1
        ? `${praise} En plein dessus !`
        : `${praise} À ${distance} près.`
      : result.closeness === 'near'
        ? `Presque ! À ${distance}.`
        : `Raté de ${distance}.`;
    return {
      correct: result.correct,
      mode: 'pin',
      expected: capital.name,
      answerLabel,
      message,
      closeness: result.closeness,
      distanceKm: result.distanceKm,
    };
  }

  // Choix d'un drapeau.
  if (input.kind === 'choice') {
    const correct = input.entityId === entity.id;
    return {
      correct,
      mode: 'choice',
      expected: entity.name,
      answerLabel: entity.name,
      message: correct
        ? praise
        : input.entityId
          ? `Ce drapeau-là : ${nameOf(input.entityId) ?? '?'}.`
          : 'Voici le bon drapeau.',
      chosenEntityId: input.entityId,
    };
  }

  // Saisie : nom du pays ou de la capitale.
  const capitalQuestion = exercise === 'name-capital';
  const expected = capitalQuestion ? entity.capital!.name : entity.name;
  const accepted = capitalQuestion ? capitalAnswers(entity) : countryAnswers(entity);
  const rivals = rivalAnswers(world, capitalQuestion ? 'capitals' : 'countries', entity.id);
  const match = matchAnswer(input.text, accepted, rivals);
  const answerLength = normalize(expected).replace(/ /g, '').length;
  let message: string;
  if (match.status === 'exact') message = praise;
  else if (match.status === 'close') message = `${praise} On écrit « ${match.matched} ».`;
  else if (match.confusedWith) {
    message = `« ${match.confusedWith} » : c'est ${capitalQuestion ? 'une autre capitale' : 'un autre pays'}.`;
  } else message = input.text.trim() ? 'Pas tout à fait.' : 'Voici la bonne réponse.';
  return {
    correct: match.status !== 'wrong',
    mode: 'type',
    expected,
    answerLabel: capitalQuestion ? `${expected} (${entity.name})` : expected,
    message,
    typed: input.text,
    answerLength,
  };
}

/** Une ligne du journal de la manche (en mémoire, pour le bilan). */
export interface SessionLogEntry {
  exercise: ExerciseId;
  entityId: string;
  correct: boolean;
  firstAttempt: boolean;
  responseMs: number;
  distanceKm?: number;
  masteryBefore?: MasteryLevel;
  masteryAfter?: MasteryLevel;
}

export interface SessionSummary {
  total: number;
  /** Éléments réussis du premier coup. */
  firstTryCorrect: number;
  /** Part des éléments réussis du premier coup (0 à 1). */
  accuracy: number;
  durationMs: number;
  /** Distance moyenne au but (km) pour les capitales placées, sinon null. */
  averageDistanceKm: number | null;
  /** Questions ratées au premier essai, à revoir. */
  missed: QuestionRef[];
  /** Éléments passés à « acquis » ou « maîtrisé » pendant la manche. */
  promoted: Array<QuestionRef & { level: MasteryLevel }>;
}

const MASTERY_RANK: Record<MasteryLevel, number> = { new: 0, learning: 1, acquired: 2, mastered: 3 };

export function summarize(log: SessionLogEntry[], durationMs: number): SessionSummary {
  const first = log.filter((entry) => entry.firstAttempt);
  const firstTryCorrect = first.filter((entry) => entry.correct).length;
  const distances = first
    .filter((entry) => entry.exercise === 'locate-capital')
    .map((entry) => entry.distanceKm)
    .filter((d): d is number => d !== undefined && Number.isFinite(d));
  const promoted = first.flatMap((entry) => {
    const { masteryBefore: before, masteryAfter: after } = entry;
    if (!before || !after || MASTERY_RANK[after] <= MASTERY_RANK[before] || MASTERY_RANK[after] < 2) return [];
    return [{ exercise: entry.exercise, entityId: entry.entityId, level: after }];
  });
  return {
    total: first.length,
    firstTryCorrect,
    accuracy: first.length ? firstTryCorrect / first.length : 0,
    durationMs,
    averageDistanceKm: distances.length ? distances.reduce((sum, d) => sum + d, 0) / distances.length : null,
    missed: first.filter((entry) => !entry.correct).map(({ exercise, entityId }) => ({ exercise, entityId })),
    promoted,
  };
}

/**
 * La saisie correspond-elle exactement (aux accents et à la casse près) à une réponse acceptée ?
 * Sert à valider dès que le nom est juste, sans attendre Entrée. Une saisie approchée (petite faute)
 * n'est pas validée en cours de frappe : on attend Entrée, pour ne pas couper la fin du mot.
 */
export function isExactTypedAnswer(exercise: ExerciseId, entity: CountryEntity, text: string, world: WorldData): boolean {
  const capitalQuestion = exercise === 'name-capital';
  const accepted = capitalQuestion ? capitalAnswers(entity) : countryAnswers(entity);
  const rivals = rivalAnswers(world, capitalQuestion ? 'capitals' : 'countries', entity.id);
  return matchAnswer(text, accepted, rivals).status === 'exact';
}
