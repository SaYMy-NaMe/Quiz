import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '@/app';
import { createContainer } from '@/container';
import { openDatabase } from '@/services/database';
import { formatHms, safeFilename } from './timestamp';

describe('timestamp helpers', () => {
  it('formats durations and filenames', () => {
    expect(formatHms(3725)).toBe('01:02:05');
    expect(safeFilename('Algebra I: Midterm!')).toBe('algebra-i-midterm');
  });
});

describe('Excel export', () => {
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  let quizId: string;

  beforeEach(async () => {
    app = createApp(createContainer({ db: openDatabase(':memory:') }));
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'A', email: 'a@x.io', password: 'password123' });
    const created = await agent.post('/api/quizzes').send({
      title: 'Export Me',
      examineeFields: [
        { fieldId: 'name', label: 'Full Name', type: 'text', required: true },
        { fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] },
      ],
      questions: [{ prompt: 'Capital of France?', options: [{ text: 'Paris' }, { text: 'Rome' }], correctIndex: 0, points: 4 }],
    });
    quizId = created.body.quiz.id;
    const qid = created.body.quiz.questions[0].id;
    const correct = created.body.quiz.questions[0].correctOptionId;
    const pub = await agent.post(`/api/quizzes/${quizId}/publish`);
    const token = pub.body.quiz.shareToken;
    for (const [name, section, right] of [['Zoe', 'A', false], ['Ann', 'B', true]] as const) {
      const started = await request(app).post(`/api/share/${token}/attempts`).send({ examinee: { name, section } });
      await request(app).post(`/api/share/${token}/attempts/${started.body.attempt.id}/submit`).send({ answers: right ? { [qid]: correct } : {} });
    }
  });

  it('streams an xlsx with dynamic examinee headers, scores, durations and ISO timestamps', async () => {
    const res = await agent.get(`/api/quizzes/${quizId}/export/xlsx`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(/export-me-submissions-.*\.xlsx/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const sheet = wb.getWorksheet('Submissions')!;
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    expect(headers.slice(0, 5)).toEqual(['Rank', 'Full Name', 'Section', 'Score', 'Max Score']);
    expect(headers).toContain('Submitted At (ISO-8601)');
    expect(sheet.rowCount).toBe(3);
    const first = sheet.getRow(2).values as unknown[];
    expect(first[1]).toBe(1);
    expect(first[2]).toBe('Ann');
    expect(first[3]).toBe('B');
    expect(first[4]).toBe(4);
    const isoIdx = headers.indexOf('Submitted At (ISO-8601)') + 1;
    expect(String(first[isoIdx])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const answers = wb.getWorksheet('Answers')!;
    expect(answers.rowCount).toBe(3);

    const summary = wb.getWorksheet('Summary')!;
    const rows = summary.getSheetValues() as unknown[][];
    const find = (label: string) => rows.find((r) => r?.[1] === label)?.[2];
    expect(find('Quiz')).toBe('Export Me');
    expect(find('Submissions')).toBe(2);
    expect(find('Average Percent')).toBe(50);
    expect(String(find('Exported At (ISO-8601)'))).toMatch(/Z$/);
    expect(String(rows.at(-1)?.[2])).toBe("50% · 1 / 1");
    expect((answers.getRow(2).values as unknown[]).slice(1)).toContain('Paris');
  });

  it('is instructor-only and ownership-scoped', async () => {
    expect((await request(app).get(`/api/quizzes/${quizId}/export/xlsx`)).status).toBe(401);
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ name: 'B', email: 'b@x.io', password: 'password123' });
    expect((await other.get(`/api/quizzes/${quizId}/export/xlsx`)).status).toBe(404);
  });
});
