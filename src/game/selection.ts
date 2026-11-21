// Choix des éléments d'une manche selon le type de contenu demandé (§ 6) :
// à réviser, nouveaux, mélange ou points faibles.
import { cardKey, isDue, type MemoryCard, type Skill } from '../engine/srs.ts';
import type { CardRecord } from '../storage/schema.ts';

export type Rng = () => number;

export type ContentType = 'due' | 'new' | 'mix' | 'weak';

/**
 * Tirage pseudo-aléatoire reproductible à partir d'un texte (mulberry32) : deux joueurs d'un même
 * défi voient ainsi les mêmes propositions de drapeaux.
 */
export function seededRng(seed: string): Rng {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange (Fisher-Yates) sans modifier le tableau d'origine. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Faiblesse d'une carte déjà vue, pour classer les « points faibles » : oublis passés,
 * difficulté FSRS, et probabilité de souvenir estimée aujourd'hui (formule FSRS classique,
 * suffisante pour un classement).
 */
export function weakness(card: Pick<MemoryCard, 'lapses' | 'difficulty' | 'stability' | 'lastReviewAt'>, now: Date): number {
  const elapsedDays = card.lastReviewAt ? Math.max(0, (now.getTime() - card.lastReviewAt.getTime()) / DAY_MS) : 0;
  const retrievability = card.stability > 0 ? (1 + (19 / 81) * (elapsedDays / card.stability)) ** -0.5 : 0;
  return card.lapses + 2 * (1 - retrievability) + card.difficulty / 10;
}

interface Groups {
  /** Révisions dues, les plus en retard d'abord. */
  due: string[];
  /** Jamais vus (dans un ordre aléatoire). */
  fresh: string[];
  /** Déjà vus, pas encore dus, les plus proches de leur révision d'abord. */
  later: string[];
  /** Déjà vus, les plus faibles d'abord. */
  weak: string[];
}

function group(eligibleIds: string[], skill: Skill, cards: Map<string, CardRecord>, now: Date, rng: Rng): Groups {
  const card = (id: string) => cards.get(cardKey(id, skill))?.card;
  const seen = (id: string) => (card(id)?.reps ?? 0) > 0;
  const byDue = (a: string, b: string) => card(a)!.dueAt.getTime() - card(b)!.dueAt.getTime();
  const mixed = shuffle(eligibleIds, rng);
  return {
    due: mixed.filter((id) => seen(id) && isDue(card(id)!, now)).sort(byDue),
    fresh: mixed.filter((id) => !seen(id)),
    later: mixed.filter((id) => seen(id) && !isDue(card(id)!, now)).sort(byDue),
    weak: mixed.filter(seen).sort((a, b) => weakness(card(b)!, now) - weakness(card(a)!, now)),
  };
}

export interface ContentCounts {
  total: number;
  due: number;
  fresh: number;
  seen: number;
}

/** Nombre d'éléments disponibles pour chaque type de contenu (affiché dans le constructeur). */
export function contentCounts(eligibleIds: string[], skill: Skill, cards: Map<string, CardRecord>, now: Date): ContentCounts {
  const groups = group(eligibleIds, skill, cards, now, () => 0);
  return { total: eligibleIds.length, due: groups.due.length, fresh: groups.fresh.length, seen: groups.weak.length };
}

/** Nombre d'éléments disponibles pour un type de contenu. */
export function availableFor(content: ContentType, counts: ContentCounts): number {
  switch (content) {
    case 'due':
      return counts.due;
    case 'new':
      return counts.fresh;
    case 'weak':
      return counts.seen;
    case 'mix':
      return counts.total;
  }
}

/**
 * Choisit les éléments d'une manche, puis mélange l'ordre des questions.
 * - à réviser : seulement les révisions dues, les plus en retard d'abord ;
 * - nouveaux : seulement des éléments jamais vus ;
 * - points faibles : les éléments déjà vus les plus fragiles ;
 * - mélange : les révisions dues, puis des nouveautés, puis les autres.
 */
export function selectItems(
  eligibleIds: string[],
  skill: Skill,
  cards: Map<string, CardRecord>,
  options: { content: ContentType; count: number | 'all' },
  now: Date,
  rng: Rng = Math.random,
): string[] {
  const groups = group(eligibleIds, skill, cards, now, rng);
  const ordered = {
    due: groups.due,
    new: groups.fresh,
    weak: groups.weak,
    mix: [...groups.due, ...groups.fresh, ...groups.later],
  }[options.content];
  return shuffle(options.count === 'all' ? ordered : ordered.slice(0, options.count), rng);
}
