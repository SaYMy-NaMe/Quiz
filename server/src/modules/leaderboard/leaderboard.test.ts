import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { createTestContainer } from '@/test/db';
import { ScoreDurationTimestampStrategy } from './ranking.strategy';
import type { Submission } from '@shared';

const sub = (id: string, score: number, durationSeconds: number, submittedAt: string): Submission => ({
  id, quizId: 'q', attemptId: id, examinee: {}, answers: {}, score, maxScore: 10, durationSeconds,
  startedAt: '', submittedAt, violations: 0, reason: 'manual',
});

describe('ScoreDurationTimestampStrategy', () => {
  it('orders by score desc, then duration asc, then timestamp asc', () => {
    const rows = [
      sub('slow-high', 10, 300, '2026-01-01T00:00:03Z'),
      sub('fast-high-late', 10, 100, '2026-01-01T00:00:02Z'),
      sub('fast-high-early', 10, 100, '2026-01-01T00:00:01Z'),
      sub('low', 4, 10, '2026-01-01T00:00:00Z'),
    ];
    const sorted = [...rows].sort((a, b) => new ScoreDurationTimestampStrategy().compare(a, b)).map((r) => r.id);
    expect(sorted).toEqual(['fast-high-early', 'fast-high-late', 'slow-high', 'low']);
  });
});

describe('leaderboard API', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let quizId: string;
  let token: string;
  let correct: string;
  let qid: string;

  const take = async (name: string, right: boolean) => {
    const started = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: { name } });
    const answers = right ? { [qid]: correct } : {};
    await request(app).post(`/api/share/${token}/attempts/${started.body.attempt.id}/submit`).send({ answers });
  };

  beforeEach(async () => {
    app = createApp(createTestContainer());
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const created = await agent.post('/api/quizzes').send({
      title: 'LB',
      examineeFields: [{ fieldId: 'name', label: 'Name', type: 'text', required: true }],
      questions: [{ prompt: 'a', options: [{ text: '1' }, { text: '2' }], correctIndex: 0, points: 5 }],
    });
    quizId = created.body.quiz.id;
    qid = created.body.quiz.questions[0].id;
    correct = created.body.quiz.questions[0].correctOptionId;
    const pub = await agent.post(`/api/quizzes/${quizId}/publish`);
    token = pub.body.quiz.shareToken;
  });

  it('ranks in real time for the instructor and is invisible to examinees', async () => {
    await take('Zed', false);
    await take('Amy', true);
    const mine = await agent.get(`/api/quizzes/${quizId}/leaderboard`);
    expect(mine.status).toBe(200);
    expect(mine.body.leaderboard.entries.map((e: { displayName: string }) => e.displayName)).toEqual(['Amy', 'Zed']);
    expect(mine.body.leaderboard.entries[0].rank).toBe(1);
    expect(mine.body.leaderboard.entries[0].examinee.name).toBe('Amy');

    await take('Bob', true); // cache must be invalidated by the submission event
    expect((await agent.get(`/api/quizzes/${quizId}/leaderboard`)).body.leaderboard.entries).toHaveLength(3);

    // No examinee-facing route exists at all (token or not).
    expect((await request(app).get(`/api/share/${token}/leaderboard`)).status).toBe(404);
    expect((await request(app).get(`/api/quizzes/${quizId}/leaderboard`)).status).toBe(401);
  });
});
