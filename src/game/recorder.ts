// Enregistrement des réponses d'une manche : note automatique, mise à jour FSRS, temps de référence
// et journal. Les calculs se font tout de suite (en mémoire) ; les écritures en base sont faites
// dans l'ordre, en arrière-plan, sans bloquer le jeu.
import { gradeAnswer, recordTiming, type AnswerMode, type Device, type GradeResult, type TimingStats } from '../engine/grading.ts';
import { cardKey, masteryOf, type MasteryLevel, type Skill, type Srs } from '../engine/srs.ts';
import { getAllCards, getTiming, recordAnswer, type GeoDatabase } from '../storage/db.ts';
import type { CardRecord } from '../storage/schema.ts';

export interface AnswerToRecord {
  entityId: string;
  skill: Skill;
  mode: AnswerMode;
  correct: boolean;
  responseMs: number;
  usedHint: boolean;
  /** Première réponse à cet élément dans la manche : elle seule met FSRS à jour. */
  firstAttempt: boolean;
  answerLength?: number;
  distanceKm?: number;
  typed?: string;
}

export interface RecordedAnswer {
  /** Note appliquée (null pour un nouvel essai dans la manche). */
  grade: GradeResult | null;
  masteryBefore: MasteryLevel;
  masteryAfter: MasteryLevel;
}

export class AnswerRecorder {
  private writes: Promise<void> = Promise.resolve();
  private failures = 0;

  private constructor(
    private readonly db: GeoDatabase,
    private readonly srs: Srs,
    private readonly device: Device,
    private readonly sessionId: string,
    /** Toutes les cartes connues, par clé. */
    readonly cards: Map<string, CardRecord>,
    private readonly timing: Map<AnswerMode, TimingStats>,
  ) {}

  static async create(db: GeoDatabase, srs: Srs, device: Device, sessionId: string): Promise<AnswerRecorder> {
    const cards = new Map((await getAllCards(db)).map((record) => [record.key, record]));
    const modes: AnswerMode[] = ['pin', 'type', 'choice'];
    const timing = new Map(await Promise.all(modes.map(async (mode) => [mode, await getTiming(db, device, mode)] as const)));
    return new AnswerRecorder(db, srs, device, sessionId, cards, timing);
  }

  /** Nombre d'écritures en base qui ont échoué (affiché si besoin, pour proposer un export). */
  get failedWrites(): number {
    return this.failures;
  }

  record(answer: AnswerToRecord, now = new Date()): RecordedAnswer {
    const key = cardKey(answer.entityId, answer.skill);
    const existing = this.cards.get(key);
    const masteryBefore = existing ? masteryOf(existing.card) : 'new';

    let grade: GradeResult | null = null;
    let cardRecord: CardRecord | undefined;
    let timing: { device: Device; mode: AnswerMode; stats: TimingStats } | undefined;
    if (answer.firstAttempt) {
      const stats = this.timing.get(answer.mode) ?? { samples: [] };
      grade = gradeAnswer({
        correct: answer.correct,
        responseMs: answer.responseMs,
        usedHint: answer.usedHint,
        mode: answer.mode,
        answerLength: answer.answerLength,
        stats,
      });
      const card = this.srs.review(existing?.card ?? this.srs.newCard(now), grade.grade, now).card;
      cardRecord = { key, entityId: answer.entityId, skill: answer.skill, card };
      this.cards.set(key, cardRecord);
      if (grade.countsForTiming) {
        const updated = recordTiming(stats, grade.normalizedMs);
        this.timing.set(answer.mode, updated);
        timing = { device: this.device, mode: answer.mode, stats: updated };
      }
    }

    const review = {
      at: now,
      cardKey: key,
      entityId: answer.entityId,
      skill: answer.skill,
      mode: answer.mode,
      device: this.device,
      correct: answer.correct,
      grade: grade?.grade ?? null,
      reason: grade?.reason ?? (answer.correct ? 'normal' : 'wrong'),
      responseMs: Math.round(answer.responseMs),
      usedHint: answer.usedHint,
      firstAttempt: answer.firstAttempt,
      sessionId: this.sessionId,
      ...(answer.distanceKm !== undefined && Number.isFinite(answer.distanceKm)
        ? { distanceKm: Math.round(answer.distanceKm * 10) / 10 }
        : {}),
      ...(answer.typed !== undefined ? { typed: answer.typed } : {}),
    } as const;

    this.writes = this.writes
      .then(() => recordAnswer(this.db, { review, card: cardRecord, timing }))
      .then(
        () => undefined,
        (error: unknown) => {
          this.failures += 1;
          console.error('Réponse non enregistrée', error);
        },
      );

    const current = this.cards.get(key);
    return { grade, masteryBefore, masteryAfter: current ? masteryOf(current.card) : 'new' };
  }

  /** Attend que toutes les réponses soient écrites. */
  flush(): Promise<void> {
    return this.writes;
  }
}
