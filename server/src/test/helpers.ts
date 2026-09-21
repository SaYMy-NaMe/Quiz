import request from 'supertest';
import { createApp } from '@/app';

export const app = createApp('');

/** Registers an instructor and returns an agent holding the JWT cookie. */
export async function instructorAgent(email = 'prof@uni.edu') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Prof', email, password: 'correct-horse-battery' });
  return agent;
}

export const mcq = (prompt: string, texts: string[], correctIndex: number, extra: Record<string, unknown> = {}) => ({
  type: 'mcq',
  prompt,
  options: texts.map((text) => ({ text })),
  correctIndex,
  ...extra,
});

export const basicQuiz = {
  title: 'Basic',
  examineeFields: [{ fieldId: 'name', label: 'Name', type: 'text', required: true }],
  questions: [mcq('2+2', ['4', '5'], 0, { points: 2 })],
};

/** Creates + publishes a quiz; returns ids and share token. */
export async function publishedQuiz(agent: ReturnType<typeof request.agent>, payload: Record<string, unknown> = basicQuiz) {
  const created = await agent.post('/api/quizzes').send(payload);
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.body)}`);
  const quiz = created.body.quiz;
  const pub = await agent.post(`/api/quizzes/${quiz.id}/publish`);
  return { quiz, token: pub.body.quiz.shareToken as string };
}

export async function takeQuiz(token: string, examinee: Record<string, unknown>, answer: (questions: { id: string; type: string; options: { id: string; text: string }[] }[]) => Record<string, string>, reason = 'manual') {
  const started = await request(app).post(`/api/quizzes/v/${token}/attempts`).send({ examinee });
  if (started.status !== 201) throw new Error(`start failed: ${JSON.stringify(started.body)}`);
  const attemptId = started.body.attempt.id as string;
  const sub = await request(app).post(`/api/quizzes/v/${token}/attempts/${attemptId}/submit`).send({ answers: answer(started.body.questions), reason });
  return { attemptId, started: started.body, receipt: sub.body.receipt, status: sub.status };
}
