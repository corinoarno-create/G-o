// Répétition espacée avec FSRS (bibliothèque ts-fsrs, modèle FSRS-7).
// Une « carte mémoire » par couple élément × compétence (§ 5.3) : « France — placer » et
// « France — capitale » sont suivies séparément.
import { DefaultScheduler, Rating, State, type DefaultSchedulerCard } from 'ts-fsrs';
import type { Grade } from './grading.ts';
import { ENGINE_SETTINGS } from './settings.ts';

/** Compétences travaillées en V1. La liste s'allongera (villes, départements, numéros…). */
export type Skill =
  | 'locate-country' // placer le pays sur la carte (Épingler)
  | 'name-country' // nommer le pays mis en évidence (Saisir)
  | 'locate-capital' // placer la capitale sur la carte (au plus près)
  | 'capital-country' // retrouver le pays d'une capitale (clic sur le pays)
  | 'name-capital' // donner la capitale du pays
  | 'flag'; // reconnaître le drapeau

export const SKILL_LABELS: Record<Skill, string> = {
  'locate-country': 'Placer le pays',
  'name-country': 'Nommer le pays',
  'locate-capital': 'Placer la capitale',
  'capital-country': 'Capitale → pays',
  'name-capital': 'Donner la capitale',
  flag: 'Reconnaître le drapeau',
};

/**
 * Deux volets (lot 2, 22/11/2026) :
 * - le **carnet** : ce que j'entretiens (pays, capitales, drapeaux) ; il colore la carte de conquête ;
 * - l'**expert** : la précision (placer les capitales, puis les villes) ; un bonus qui ne fait jamais baisser
 *   le carnet, avec ses propres révisions et un sceau doré par pays.
 */
export type Track = 'carnet' | 'expert';

export const EXPERT_SKILLS: ReadonlySet<Skill> = new Set<Skill>(['locate-capital']);

export const trackOf = (skill: Skill): Track => (EXPERT_SKILLS.has(skill) ? 'expert' : 'carnet');

/** Compétences d'un volet, dans l'ordre de SKILL_LABELS. */
export const skillsOf = (track: Track): Skill[] => (Object.keys(SKILL_LABELS) as Skill[]).filter((skill) => trackOf(skill) === track);

/** Identifiant d'une carte mémoire : « fr:name-capital ». */
export const cardKey = (entityId: string, skill: Skill) => `${entityId}:${skill}`;

export function parseCardKey(key: string): { entityId: string; skill: Skill } {
  const separator = key.lastIndexOf(':');
  return { entityId: key.slice(0, separator), skill: key.slice(separator + 1) as Skill };
}

export type MemoryCard = DefaultSchedulerCard;

/** Niveaux de maîtrise d'un élément (§ 8) : nouveau → en cours → acquis → maîtrisé. */
export type MasteryLevel = 'new' | 'learning' | 'acquired' | 'mastered';

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  new: 'Nouveau',
  learning: 'En cours',
  acquired: 'Acquis',
  mastered: 'Maîtrisé',
};

const RATINGS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const satisfies Record<Grade, number>;

/** Niveau de maîtrise d'une carte, d'après la stabilité de la mémoire (en jours). */
export function masteryOf(card: Pick<MemoryCard, 'state' | 'stability'>): MasteryLevel {
  const { acquiredDays, masteredDays } = ENGINE_SETTINGS.srs.mastery;
  if (card.state === State.New) return 'new';
  if (card.state !== State.Review) return 'learning'; // en apprentissage ou réapprentissage après un oubli
  if (card.stability >= masteredDays) return 'mastered';
  if (card.stability >= acquiredDays) return 'acquired';
  return 'learning';
}

/** Une carte est due quand sa date de révision est passée (les cartes neuves ne sont pas « dues »). */
export function isDue(card: Pick<MemoryCard, 'state' | 'dueAt'>, now: Date): boolean {
  return card.state !== State.New && card.dueAt.getTime() <= now.getTime();
}

export interface Srs {
  newCard(now: Date): MemoryCard;
  /** Applique une note et renvoie la nouvelle carte et le journal de révision. */
  review(card: MemoryCard, grade: Grade, now: Date): { card: MemoryCard; revlog: unknown };
  /** Probabilité estimée de s'en souvenir à cet instant (0 à 1), ou null pour une carte neuve. */
  retrievability(card: MemoryCard, now: Date): number | null;
}

export interface SrsSettings {
  desiredRetention: number;
  maximumIntervalDays: number;
  enableFuzz: boolean;
}

/** Crée le planificateur FSRS avec nos réglages. */
export async function createSrs(settings: SrsSettings = ENGINE_SETTINGS.srs): Promise<Srs> {
  const scheduler = await DefaultScheduler({
    desiredRetention: settings.desiredRetention,
    maximumInterval: settings.maximumIntervalDays,
    enableFuzz: settings.enableFuzz,
  });
  return {
    newCard: (now) => scheduler.newCard({ now }),
    review: (card, grade, now) => {
      const result = scheduler.review({ card, grade: RATINGS[grade], now });
      return { card: result.card, revlog: result.revlog };
    },
    retrievability: (card, now) => {
      if (card.state === State.New || !card.lastReviewAt) return null;
      const elapsed = scheduler.chrono.difference(card.lastReviewAt, now);
      return scheduler.model.forgettingCurve(card, elapsed);
    },
  };
}
