// Boucle de consolidation façon Seterra (§ 5.1) : un élément raté revient dans la manche
// quelques questions plus tard, jusqu'à ce qu'il soit réussi. La manche se termine quand
// chaque élément a été réussi au moins une fois.
//
// L'état est un simple objet sérialisable (pour pouvoir reprendre une manche interrompue) ;
// les fonctions renvoient un nouvel état sans modifier l'ancien.
import { ENGINE_SETTINGS } from './settings.ts';

export interface ConsolidationState {
  /** Éléments à venir, dans l'ordre ; le premier est la question en cours. */
  queue: string[];
  /** Nombre de réponses données par élément. */
  attempts: Record<string, number>;
  /** Résultat de la première réponse de chaque élément (c'est elle seule qui met à jour FSRS). */
  firstResult: Record<string, boolean>;
  /** Éléments réussis au moins une fois. */
  solved: string[];
  /** Nombre d'éléments distincts de la manche. */
  total: number;
}

export interface AnswerOutcome {
  item: string;
  correct: boolean;
  /** Vrai si c'était la première réponse à cet élément dans la manche. */
  firstAttempt: boolean;
  /** Si raté : nombre d'autres questions avant qu'il revienne (0 = tout de suite). « On le revoit dans 3 questions. » */
  retryIn: number | null;
}

export function createConsolidation(items: string[]): ConsolidationState {
  const unique = [...new Set(items)];
  return { queue: unique, attempts: {}, firstResult: {}, solved: [], total: unique.length };
}

export function currentItem(state: ConsolidationState): string | null {
  return state.queue[0] ?? null;
}

export function isFinished(state: ConsolidationState): boolean {
  return state.queue.length === 0;
}

export function progress(state: ConsolidationState): { solved: number; total: number } {
  return { solved: state.solved.length, total: state.total };
}

/** Enregistre la réponse à la question en cours et prépare la suivante. */
export function submitAnswer(
  state: ConsolidationState,
  correct: boolean,
  retryDelay: number = ENGINE_SETTINGS.consolidation.retryDelay,
): { state: ConsolidationState; outcome: AnswerOutcome } {
  const item = currentItem(state);
  if (item === null) throw new Error('La manche est terminée : plus de question en cours.');

  const previousAttempts = state.attempts[item] ?? 0;
  const firstAttempt = previousAttempts === 0;
  const rest = state.queue.slice(1);
  let queue = rest;
  let retryIn: number | null = null;
  if (!correct) {
    // Il revient après `retryDelay` autres questions, ou à la fin s'il en reste moins.
    const position = Math.min(Math.max(retryDelay, 0), rest.length);
    queue = [...rest.slice(0, position), item, ...rest.slice(position)];
    retryIn = position;
  }

  return {
    state: {
      queue,
      attempts: { ...state.attempts, [item]: previousAttempts + 1 },
      firstResult: firstAttempt ? { ...state.firstResult, [item]: correct } : state.firstResult,
      solved: correct && !state.solved.includes(item) ? [...state.solved, item] : state.solved,
      total: state.total,
    },
    outcome: { item, correct, firstAttempt, retryIn },
  };
}
