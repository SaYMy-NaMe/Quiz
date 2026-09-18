import { describe, it, expect } from 'vitest';
import { computeAnalytics } from './analytics.service';
import { QuestionFactory } from '@/modules/quiz';
import type { Quiz, Submission } from '@shared';

const q = QuestionFactory.create({ prompt: 'p', promptType: 'text', options: [{ text: 'a' }, { text: 'b' }], correctIndex: 0, points: 2 });
const quiz = { id: 'q', questions: [q], examineeFields: [] } as unknown as Quiz;
const sub = (score: number, answer: string | undefined, reason: Submission['reason'], violations = 0): Submission => ({
  id: Math.random().toString(36), quizId: 'q', attemptId: 'a', examinee: {}, answers: answer ? { [q.id]: answer } : {},
  score, maxScore: 2, durationSeconds: 30, startedAt: '', submittedAt: '', violations, reason,
});

describe('computeAnalytics', () => {
  it('aggregates scores, reasons, violations and per-question distributions', () => {
    const a = computeAnalytics(quiz, [
      sub(2, q.options[0]!.id, 'manual'),
      sub(0, q.options[1]!.id, 'timeout', 1),
      sub(0, undefined, 'violation', 2),
    ]);
    expect(a.submissionCount).toBe(3);
    expect(a.averageScore).toBe(0.67);
    expect(a.averagePercent).toBe(33.33);
    expect(a.highestScore).toBe(2);
    expect(a.reasons).toEqual({ manual: 1, timeout: 1, violation: 1 });
    expect(a.totalViolations).toBe(3);
    expect(a.questions[0]!.answered).toBe(2);
    expect(a.questions[0]!.correct).toBe(1);
    expect(a.questions[0]!.correctRate).toBe(0.33);
    expect(a.questions[0]!.distribution).toEqual({ [q.options[0]!.id]: 1, [q.options[1]!.id]: 1 });
  });
  it('handles no submissions', () => {
    const a = computeAnalytics(quiz, []);
    expect(a.averageScore).toBeNull();
    expect(a.questions[0]!.correctRate).toBe(0);
  });
});
