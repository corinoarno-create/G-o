// Schéma de la base IndexedDB qui garde ma progression (§ 2 : stockée localement).
import type { DBSchema } from 'idb';
import type { AnswerMode, Device, Grade, GradeReason } from '../engine/grading.ts';
import type { MemoryCard, Skill } from '../engine/srs.ts';

/** Nom de la base dans le navigateur. */
export const DB_NAME = 'geo';
/** Version du schéma : à augmenter (avec une migration dans db.ts) à chaque changement de structure. */
export const DB_VERSION = 1;

/** Carte mémoire FSRS d'un couple élément × compétence. */
export interface CardRecord {
  /** « fr:name-capital » */
  key: string;
  entityId: string;
  skill: Skill;
  card: MemoryCard;
}

/** Une réponse donnée (§ 5.3 : horodatage, mode, justesse, distance, temps, indice). */
export interface ReviewRecord {
  /** Attribué par la base. */
  id?: number;
  at: Date;
  cardKey: string;
  entityId: string;
  skill: Skill;
  /** Façon de répondre : clic sur la carte, saisie, choix multiple. */
  mode: AnswerMode;
  device: Device;
  correct: boolean;
  /** Note FSRS appliquée (null si la réponse n'a pas mis FSRS à jour : nouvel essai dans la manche). */
  grade: Grade | null;
  reason: GradeReason;
  responseMs: number;
  usedHint: boolean;
  /** Première réponse à cet élément dans la manche. */
  firstAttempt: boolean;
  /** Distance au but (km), pour Épingler. */
  distanceKm?: number;
  /** Texte saisi, pour Saisir. */
  typed?: string;
  /** Identifiant de la manche. */
  sessionId?: string;
}

/** Temps de réponse récents pour un couple appareil × façon de répondre (« desktop:pin »). */
export interface TimingRecord {
  key: string;
  samples: number[];
}

/** Réglage ou préférence quelconque (plafond de nouveautés, dernière zone choisie…). */
export interface SettingRecord {
  key: string;
  value: unknown;
}

/** Session favorite du constructeur (§ 6), ex. « Capitales d'Asie — Saisir — 20 ». */
export interface FavoriteRecord {
  id: string;
  name: string;
  /** Configuration du constructeur de session (définie à l'étape 6). */
  config: unknown;
  updatedAt: Date;
}

export interface GeoDB extends DBSchema {
  cards: {
    key: string;
    value: CardRecord;
    indexes: { 'by-entity': string; 'by-due': Date };
  };
  reviews: {
    key: number;
    value: ReviewRecord;
    indexes: { 'by-card': string; 'by-at': Date };
  };
  timing: {
    key: string;
    value: TimingRecord;
  };
  settings: {
    key: string;
    value: SettingRecord;
  };
  favorites: {
    key: string;
    value: FavoriteRecord;
  };
}

export type StoreName = 'cards' | 'reviews' | 'timing' | 'settings' | 'favorites';
export const STORE_NAMES: StoreName[] = ['cards', 'reviews', 'timing', 'settings', 'favorites'];

/** Contenu complet de la base, pour l'export, l'import et les tests. */
export interface ProgressSnapshot {
  cards: CardRecord[];
  reviews: ReviewRecord[];
  timing: TimingRecord[];
  settings: SettingRecord[];
  favorites: FavoriteRecord[];
}

export const emptySnapshot = (): ProgressSnapshot => ({
  cards: [],
  reviews: [],
  timing: [],
  settings: [],
  favorites: [],
});
