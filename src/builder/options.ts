// Options du constructeur de session (§ 6) : catégorie, mode, nombre, type de contenu,
// et ce qu'on enregistre pour une session favorite.
import type { ExerciseId } from '../game/exercises.ts';
import type { ContentType } from '../game/selection.ts';

export type CategoryId = 'countries' | 'capitals' | 'flags' | 'expert-capitals' | 'cities';

/**
 * Deux modes de jeu (refonte du 22/11/2026) : Initié (ce que j'entretiens : pays, capitales, drapeaux) et
 * Expert (la précision : placer les capitales, placer et nommer les villes).
 */
export type GameMode = 'initie' | 'expert';

export const GAME_MODES: Array<{ id: GameMode; label: string }> = [
  { id: 'initie', label: 'Initié' },
  { id: 'expert', label: 'Expert' },
];

export interface ModeOption {
  id: string;
  label: string;
  exercise: ExerciseId;
}

export interface Category {
  id: CategoryId;
  label: string;
  modes: ModeOption[];
  /** Mode de jeu de la catégorie. L'Expert a un style doré, des révisions à part, et ne compte pas dans le carnet. */
  mode: GameMode;
}

/** Catégories ; les villes rejoindront l'Expert, les départements et États viendront ensuite. */
export const CATEGORIES: Category[] = [
  {
    id: 'countries',
    label: 'Pays',
    mode: 'initie',
    modes: [
      { id: 'pin', label: 'Placer', exercise: 'locate-country' },
      { id: 'type', label: 'Nommer', exercise: 'name-country' },
    ],
  },
  {
    id: 'capitals',
    label: 'Capitales',
    mode: 'initie',
    modes: [
      { id: 'country', label: 'Quel pays ?', exercise: 'capital-to-country' },
      { id: 'type', label: 'Saisir', exercise: 'name-capital' },
    ],
  },
  {
    id: 'flags',
    label: 'Drapeaux',
    mode: 'initie',
    modes: [
      { id: 'flag-to-country', label: 'Drapeau → pays', exercise: 'flag-to-country' },
      { id: 'country-to-flag', label: 'Pays → drapeau', exercise: 'country-to-flag' },
    ],
  },
  {
    id: 'expert-capitals',
    label: 'Capitales',
    mode: 'expert',
    modes: [{ id: 'capital-pin', label: 'Placer', exercise: 'locate-capital' }],
  },
  {
    id: 'cities',
    label: 'Villes',
    mode: 'expert',
    modes: [
      { id: 'city-pin', label: 'Placer', exercise: 'locate-city' },
      { id: 'city-type', label: 'Nommer', exercise: 'name-city' },
    ],
  },
];

export const CONTENT_TYPES: Array<{ id: ContentType; label: string; description: string }> = [
  { id: 'mix', label: 'Mélange', description: 'Révisions dues d’abord, puis nouveautés' },
  { id: 'due', label: 'À réviser', description: 'Seulement ce qui est dû aujourd’hui' },
  { id: 'new', label: 'Nouveaux', description: 'Seulement ce que je n’ai jamais vu' },
  { id: 'weak', label: 'Points faibles', description: 'Ce que j’oublie le plus' },
];

export const COUNTS: Array<number | 'all'> = [10, 20, 50, 'all'];

/** Réglages d'une session, tels qu'on les enregistre (favori, dernière session). */
export interface BuilderChoice {
  zoneId: string;
  category: CategoryId;
  mode: string;
  count: number | 'all';
  content: ContentType;
}

export const DEFAULT_CHOICE: BuilderChoice = {
  zoneId: 'world',
  category: 'countries',
  mode: 'pin',
  count: 10,
  content: 'mix',
};

/** Catégories d'un mode de jeu. */
export const categoriesOf = (mode: GameMode) => CATEGORIES.filter((category) => category.mode === mode);

/** Nom d'une catégorie avec son mode quand il prête à confusion (« Capitales · Expert »). */
export const categoryLabel = (category: Category) => (category.mode === 'expert' ? `${category.label} · Expert` : category.label);

export function categoryOf(id: CategoryId): Category {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0]!;
}

/** Mode choisi, ou le premier de la catégorie si le mode n'y existe pas. */
export function modeOf(choice: Pick<BuilderChoice, 'category' | 'mode'>): ModeOption {
  const category = categoryOf(choice.category);
  return category.modes.find((mode) => mode.id === choice.mode) ?? category.modes[0]!;
}

export const countLabel = (count: number | 'all') => (count === 'all' ? 'tout' : String(count));

/** Nom proposé pour un favori : « Capitales · Asie · Saisir · 20 ». */
export function defaultFavoriteName(choice: BuilderChoice, zoneLabel: string): string {
  const content = choice.content === 'mix' ? [] : [CONTENT_TYPES.find((c) => c.id === choice.content)!.label];
  return [categoryLabel(categoryOf(choice.category)), zoneLabel, modeOf(choice).label, ...content, countLabel(choice.count)].join(' · ');
}

/**
 * Choix enregistré avec une ancienne version : « Capitales → Placer » (avant le lot 2) et la catégorie « Expert »
 * (lot 2) sont devenus les catégories Capitales et Villes du mode Expert. À appliquer seulement à ce qu'on relit
 * en base (pas à un changement de catégorie en cours).
 */
export function migrateStoredChoice<T>(value: T): T {
  const raw = value as { category?: string; mode?: string } | null;
  if (!raw || typeof raw !== 'object') return value;
  if (raw.category === 'capitals' && raw.mode === 'pin') return { ...raw, category: 'expert-capitals', mode: 'capital-pin' } as T;
  // Catégorie « Expert » du lot 2, découpée en Capitales et Villes du mode Expert.
  if (raw.category === 'expert') return { ...raw, category: raw.mode?.startsWith('city') ? 'cities' : 'expert-capitals' } as T;
  return value;
}

/** Vérifie un choix relu en base (favori ou dernière session) et complète ce qui manque. */
export function sanitizeChoice(value: unknown): BuilderChoice {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<BuilderChoice>;
  const category = CATEGORIES.some((c) => c.id === raw.category) ? raw.category! : DEFAULT_CHOICE.category;
  return {
    zoneId: typeof raw.zoneId === 'string' ? raw.zoneId : DEFAULT_CHOICE.zoneId,
    category,
    mode: modeOf({ category, mode: typeof raw.mode === 'string' ? raw.mode : '' }).id,
    count: COUNTS.includes(raw.count as number | 'all') ? (raw.count as number | 'all') : DEFAULT_CHOICE.count,
    content: CONTENT_TYPES.some((c) => c.id === raw.content) ? raw.content! : DEFAULT_CHOICE.content,
  };
}
