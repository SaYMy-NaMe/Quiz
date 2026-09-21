import { describe, it, expect } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { app, instructorAgent, publishedQuiz, takeQuiz, mcq } from '@/test/helpers';

const quizPayload = {
  title: 'Dash',
  examineeFields: [
    { fieldId: 'name', label: 'Full Name', type: 'text', required: true },
    { fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] },
  ],
  questions: [mcq('q1', ['a', 'b', 'c'], 0, { points: 4 }), { type: 'long', prompt: 'essay', points: 6, required: false }],
};

describe('instructor dashboard', () => {
  it('ranks, aggregates analytics, grades text answers manually and exports xlsx', async () => {
    const agent = await instructorAgent();
    const { quiz, token } = await publishedQuiz(agent, quizPayload);
    const [q1, essay] = quiz.questions;
    const zoe = await takeQuiz(token, { name: 'Zoe', section: 'A' }, () => ({}), 'timeout');
    const ann = await takeQuiz(token, { name: 'Ann', section: 'B' }, () => ({ [q1!.id]: q1!.correctOptionId!, [essay!.id]: 'great essay' }));
    expect(ann.receipt).toMatchObject({ score: 4, maxScore: 10, needsReview: true });

    const board = await agent.get(`/api/quizzes/${quiz.id}/leaderboard`);
    expect(board.body.leaderboard.entries.map((e: { displayName: string }) => e.displayName)).toEqual(['Ann', 'Zoe']);
    expect((await request(app).get(`/api/quizzes/${quiz.id}/leaderboard`)).status).toBe(401);
    expect((await request(app).get(`/api/quizzes/v/${token}/leaderboard`)).status).toBe(404);

    const graded = await agent.patch(`/api/quizzes/${quiz.id}/submissions/${ann.attemptId}/grade`).send({ grades: { [essay!.id]: 99 } });
    expect(graded.body.submission).toMatchObject({ score: 10, needsReview: false, manualScores: { [essay!.id]: 6 } }); // capped at points
    expect((await agent.patch(`/api/quizzes/${quiz.id}/submissions/${ann.attemptId}/grade`).send({ grades: { [q1!.id]: 1 } })).status).toBe(400);

    const a = (await agent.get(`/api/quizzes/${quiz.id}/analytics`)).body.analytics;
    expect(a).toMatchObject({ submissionCount: 2, pendingReview: 0, maxScore: 10, highestScore: 10, reasons: { manual: 1, timeout: 1, violation: 0 } });
    expect(a.questions[0].distribution[q1!.correctOptionId!]).toBe(1);
    expect(a.questions[1]).toMatchObject({ type: 'long', answered: 1, correct: 1 });

    const regrade = await agent.post(`/api/quizzes/${quiz.id}/regrade`);
    expect(regrade.body.result).toEqual({ quizId: quiz.id, regraded: 2, changed: 0 });

    const res = await agent.get(`/api/quizzes/${quiz.id}/export/xlsx`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.headers['content-disposition']).toMatch(/dash-submissions-.*\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const sheet = wb.getWorksheet('Submissions')!;
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    expect(headers.slice(0, 5)).toEqual(['Rank', 'Full Name', 'Section', 'Score', 'Max Score']);
    expect((sheet.getRow(2).values as unknown[])[2]).toBe('Ann');
    expect(String((sheet.getRow(2).values as unknown[])[headers.indexOf('Submitted At (ISO-8601)') + 1])).toMatch(/Z$/);
    const answers = wb.getWorksheet('Answers')!;
    expect(answers.rowCount).toBe(1 + 2 * 2);
    expect(JSON.stringify(answers.getRow(3).values)).toContain('great essay');
    expect(wb.getWorksheet('Summary')!.getRow(2).getCell(2).value).toBe('Dash');
    expect(zoe.receipt.reason).toBe('timeout');
  });
});
