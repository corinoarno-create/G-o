// Réglages du moteur pédagogique, regroupés ici pour pouvoir les ajuster sans fouiller le code.
// (Cahier des charges § 5.2 : « Ces seuils sont des paramètres réglables, pas des constantes enfouies. »)

export const ENGINE_SETTINGS = {
  /** Note automatique à partir du temps de réponse (§ 5.2). */
  grading: {
    /** Au-delà de ce multiple de ma médiane : « Difficile ». */
    slowFactor: 2,
    /** En dessous de ce multiple de ma médiane : « Facile ». */
    fastFactor: 0.6,
    /** Au-delà de ce multiple de ma médiane, le temps est jugé aberrant (distraction) et ignoré. */
    outlierFactor: 3,
    /** Au-delà de cette durée (ms), le temps est toujours ignoré. */
    outlierMaxMs: 30_000,
    /** Nombre minimal de temps mesurés avant de tenir compte de la vitesse (sinon : « Correct »). */
    minSamples: 5,
    /** Nombre de temps récents conservés pour calculer la médiane. */
    maxSamples: 60,
    /**
     * Correction de longueur en mode Saisir : un nom de `lengthReference` lettres compte pour 1 ;
     * le poids d'un nom vaut (lengthBase + longueur) / (lengthBase + lengthReference).
     * Ex. : « Lima » ≈ 0,75, « Ouagadougou » ≈ 1,19.
     */
    lengthBase: 8,
    lengthReference: 8,
  },

  /** Tolérance aux fautes de frappe en mode Saisir (distance de Levenshtein). */
  typing: {
    /** Nombre de fautes tolérées selon la longueur du nom attendu (lettres, sans espaces). */
    tolerance: [
      { maxLength: 4, typos: 0 }, // « Iran » ≠ « Irak », « Mali » ≠ « Male »
      { maxLength: 7, typos: 1 },
      { maxLength: 12, typos: 2 },
      { maxLength: Infinity, typos: 3 },
    ],
    /** Nombre maximal de propositions d'autocomplétion. */
    suggestions: 6,
  },

  /** Tolérance de distance en mode Épingler pour un point (capitale, ville). */
  pin: {
    /**
     * Rayon accepté (km) = facteur × √(superficie du pays en km²), borné entre min et max.
     * Ex. : France ≈ 0,08 × 741 ≈ 59 km ; Monaco → 20 km (minimum) ; Russie → 250 km (maximum).
     */
    toleranceFactor: 0.08,
    minToleranceKm: 20,
    maxToleranceKm: 250,
    /** Jusqu'à ce multiple de la tolérance, la réponse est fausse mais « presque » (message encourageant). */
    nearFactor: 2.5,
  },

  /** Boucle de consolidation façon Seterra (§ 5.1). */
  consolidation: {
    /** Un élément raté revient après ce nombre de questions. */
    retryDelay: 3,
  },

  /** Répétition espacée (FSRS). */
  srs: {
    /** Probabilité visée de se souvenir au moment de la révision. */
    desiredRetention: 0.9,
    /** Intervalle maximal entre deux révisions (jours). */
    maximumIntervalDays: 3650,
    /** Petite variation aléatoire des intervalles, pour ne pas tout revoir le même jour. */
    enableFuzz: true,
    /** Niveaux de maîtrise selon la stabilité de la mémoire (jours). */
    mastery: {
      /** « Acquis » à partir de cette stabilité. */
      acquiredDays: 7,
      /** « Maîtrisé » à partir de cette stabilité. */
      masteredDays: 30,
    },
  },
} as const;

export type EngineSettings = typeof ENGINE_SETTINGS;
