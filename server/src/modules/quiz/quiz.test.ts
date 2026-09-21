import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, instructorAgent, publishedQuiz, basicQuiz, mcq } from '@/test/helpers';
import { transition } from './quiz.state';

describe('quiz state machine', () => {
  it('allows only the documented transitions', () => {
    expect(transition('draft', 'publish')).toBe('published');
    expect(transition('published', 'close')).toBe('closed');
    expect(transition('closed', 'reopen')).toBe('published');
    expect(transition('published', 'unpublish')).toBe('draft');
    expect(() => transition('draft', 'close')).toThrow(/Cannot close/);
  });
});

describe('quiz authoring API', () => {
  it('supports any number of MCQ options, short/long answers and per-question required flags', async () => {
    const agent = await instructorAgent();
    const res = await agent.post('/api/quizzes').send({
      title: 'Flexible',
      settings: { shuffleQuestions: true, shuffleOptions: true },
      questions: [
        mcq('Nine choices', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], 8, { required: false }),
        { type: 'short', prompt: 'Capital of France?', acceptedAnswers: ['Paris', ' paris '], points: 3 },
        { type: 'long', prompt: 'Explain recursion.', points: 5, required: false },
      ],
    });
    expect(res.status).toBe(201);
    const q = res.body.quiz;
    expect(q.settings).toMatchObject({ shuffleQuestions: true, shuffleOptions: true, durationSeconds: 600 });
    expect(q.questions[0].options).toHaveLength(9);
    expect(q.questions[0].correctOptionId).toBe(q.questions[0].options[8].id);
    expect(q.questions[0].required).toBe(false);
    expect(q.questions[1]).toMatchObject({ type: 'short', acceptedAnswers: ['Paris', 'paris'], required: true, options: [] });
    expect(q.questions[2]).toMatchObject({ type: 'long', points: 5 });
  });

  it('rejects MCQs with fewer than two options or no answer key', async () => {
    const agent = await instructorAgent();
    expect((await agent.post('/api/quizzes').send({ title: 'x', questions: [mcq('q', ['only'], 0)] })).status).toBe(400);
    expect((await agent.post('/api/quizzes').send({ title: 'x', questions: [{ type: 'mcq', prompt: 'q', options: [{ text: 'a' }, { text: 'b' }] }] })).status).toBe(400);
  });

  it('creates, updates, publishes (token), locks edits, lists with stats, deletes with cascade', async () => {
    const agent = await instructorAgent();
    const { quiz, token } = await publishedQuiz(agent);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect((await agent.put(`/api/quizzes/${quiz.id}`).send(basicQuiz)).status).toBe(409);
    await agent.post(`/api/quizzes/${quiz.id}/unpublish`);
    const updated = await agent.put(`/api/quizzes/${quiz.id}`).send({ ...basicQuiz, title: 'Renamed', questions: quiz.questions.map((q: { id: string; options: { id: string }[] }) => ({ ...basicQuiz.questions[0], id: q.id, options: q.options.map((o, i) => ({ id: o.id, text: basicQuiz.questions[0]!.options[i]!.text })) })) });
    expect(updated.body.quiz.title).toBe('Renamed');
    expect(updated.body.quiz.questions[0].id).toBe(quiz.questions[0].id); // ids preserved on edit
    expect((await agent.post(`/api/quizzes/${quiz.id}/publish`)).body.quiz.shareToken).toBe(token); // token kept
    const list = await agent.get('/api/quizzes');
    expect(list.body.quizzes[0]).toMatchObject({ title: 'Renamed', submissionCount: 0, maxScore: 2 });
    expect((await agent.delete(`/api/quizzes/${quiz.id}`)).status).toBe(204);
    expect((await agent.get(`/api/quizzes/${quiz.id}`)).status).toBe(404);
  });

  it('hides other instructors quizzes and requires auth', async () => {
    const agent = await instructorAgent();
    const { quiz } = await publishedQuiz(agent);
    const other = await instructorAgent('other@uni.edu');
    expect((await other.get(`/api/quizzes/${quiz.id}`)).status).toBe(404);
    expect((await request(app).get('/api/quizzes')).status).toBe(401);
  });
});
