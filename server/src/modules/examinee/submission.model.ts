import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';
import type { Attempt, Submission } from '@shared';

/**
 * One document per attempt, from "Start Quiz" to submission. Replaces the SQLite
 * attempts + submissions + violation_events tables: the lifecycle is 1:1 and violation
 * events are a short, bounded list, so embedding keeps every update atomic.
 *
 * `questionOrder` / `optionOrder` freeze the per-attempt shuffle so a refresh resumes with the
 * same layout and grading never depends on presentation order.
 */
const violationEventSchema = new Schema({ kind: { type: String, required: true }, at: { type: Date, required: true } }, { _id: false });

const submissionSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    /** Step-1 metadata, keyed by the instructor's fieldId. */
    examinee: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
    /** questionId -> optionId (MCQ) or free text (short/long). */
    answers: { type: Map, of: String, default: () => new Map() },
    questionOrder: { type: [String], default: [] },
    optionOrder: { type: Map, of: [String], default: () => new Map() },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    /** Instructor grades for text questions, questionId -> points. */
    manualScores: { type: Map, of: Number, default: () => new Map() },
    needsReview: { type: Boolean, default: false },
    violations: { type: Number, default: 0 },
    violationEvents: { type: [violationEventSchema], default: [] },
    reason: { type: String, enum: ['manual', 'timeout', 'violation'], default: 'manual' },
  },
  { timestamps: true, versionKey: false },
);
// Leaderboard ordering per quiz: Score desc → Duration asc → SubmittedAt asc.
submissionSchema.index({ quiz: 1, status: 1, score: -1, durationSeconds: 1, submittedAt: 1 });

export type SubmissionSchema = InferSchemaType<typeof submissionSchema>;
export type SubmissionDoc = HydratedDocumentFromSchema<typeof submissionSchema>;
export const SubmissionModel = model('Submission', submissionSchema);

const mapToRecord = <T>(m: Map<string, T>): Record<string, T> => Object.fromEntries(m.entries());

export function toAttempt(doc: SubmissionDoc): Attempt {
  return {
    id: doc._id.toString(),
    quizId: doc.quiz.toString(),
    examinee: mapToRecord(doc.examinee) as Attempt['examinee'],
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
    violations: doc.violations,
  };
}

export function toSubmission(doc: SubmissionDoc): Submission {
  return {
    id: doc._id.toString(),
    quizId: doc.quiz.toString(),
    examinee: mapToRecord(doc.examinee) as Submission['examinee'],
    answers: mapToRecord(doc.answers),
    score: doc.score,
    maxScore: doc.maxScore,
    needsReview: doc.needsReview,
    manualScores: mapToRecord(doc.manualScores),
    durationSeconds: doc.durationSeconds,
    startedAt: doc.startedAt.toISOString(),
    submittedAt: (doc.submittedAt ?? doc.startedAt).toISOString(),
    violations: doc.violations,
    violationEvents: doc.violationEvents.map((e) => ({ kind: e.kind, at: e.at.toISOString() })),
    reason: doc.reason,
  };
}
