import ExcelJS from 'exceljs';
import type { Writable } from 'node:stream';
import type { Leaderboard, Quiz, QuizAnalytics, Submission } from '@shared';
import { formatHms, toDate, toIso } from './timestamp';

export interface ExportInput {
  quiz: Quiz;
  submissions: Submission[];
  leaderboard: Leaderboard;
  analytics: QuizAnalytics;
}

/**
 * Streams a workbook straight into the HTTP response using exceljs's streaming
 * writer, so memory stays flat regardless of the number of submissions.
 *
 * Sheet 1 "Submissions": Rank | <dynamic examinee fields…> | Score | Max | % | Time Taken (s) |
 *                        Time Taken (hh:mm:ss) | Started At | Submitted At | Violations | Reason
 * Sheet 2 "Answers":     one row per (submission, question) with chosen/correct option text.
 * Sheet 3 "Summary":     quiz metadata, export timestamp and per-question correct rates.
 */
const optionLabel = (o: { text: string; imageUrl?: string } | undefined): string =>
  o ? o.text || (o.imageUrl ? `[image] ${o.imageUrl}` : '') : '';

export async function writeSubmissionsWorkbook(out: Writable, { quiz, submissions, leaderboard, analytics }: ExportInput): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true, useSharedStrings: true });
  workbook.creator = 'Quiz Platform';
  workbook.created = new Date();

  const rankBySubmission = new Map(leaderboard.entries.map((e) => [e.submissionId, e.rank]));
  const bySubmissionId = new Map(submissions.map((s) => [s.id, s]));

  // --- Sheet 1: submissions -------------------------------------------------
  const sheet = workbook.addWorksheet('Submissions', { views: [{ state: 'frozen', ySplit: 1 }] });
  const dynamicColumns = quiz.examineeFields.map((f) => ({ header: f.label, key: `ex_${f.fieldId}`, width: Math.max(14, Math.min(40, f.label.length + 4)) }));
  sheet.columns = [
    { header: 'Rank', key: 'rank', width: 8 },
    ...dynamicColumns,
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Max Score', key: 'maxScore', width: 11 },
    { header: 'Percent', key: 'percent', width: 10 },
    { header: 'Time Taken (s)', key: 'durationSeconds', width: 15 },
    { header: 'Time Taken (hh:mm:ss)', key: 'durationHms', width: 21 },
    { header: 'Started At (ISO-8601)', key: 'startedAtIso', width: 26 },
    { header: 'Submitted At (ISO-8601)', key: 'submittedAtIso', width: 26 },
    { header: 'Submitted At (Excel date)', key: 'submittedAtDate', width: 22, style: { numFmt: 'yyyy-mm-dd hh:mm:ss' } },
    { header: 'Violations', key: 'violations', width: 11 },
    { header: 'Reason', key: 'reason', width: 12 },
    { header: 'Submission ID', key: 'id', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  // Emit in leaderboard order so the sheet reads like the ranking.
  const ordered = leaderboard.entries.map((e) => bySubmissionId.get(e.submissionId)).filter((s): s is Submission => Boolean(s));
  for (const s of ordered) {
    const row: Record<string, unknown> = {
      rank: rankBySubmission.get(s.id) ?? null,
      score: s.score,
      maxScore: s.maxScore,
      percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 10000) / 100 : 0,
      durationSeconds: s.durationSeconds,
      durationHms: formatHms(s.durationSeconds),
      startedAtIso: toIso(s.startedAt),
      submittedAtIso: toIso(s.submittedAt),
      submittedAtDate: toDate(s.submittedAt),
      violations: s.violations,
      reason: s.reason,
      id: s.id,
    };
    for (const f of quiz.examineeFields) row[`ex_${f.fieldId}`] = s.examinee[f.fieldId] ?? '';
    sheet.addRow(row).commit();
  }
  sheet.commit();

  // --- Sheet 2: per-question answers ---------------------------------------
  const answers = workbook.addWorksheet('Answers', { views: [{ state: 'frozen', ySplit: 1 }] });
  answers.columns = [
    { header: 'Submission ID', key: 'id', width: 20 },
    ...dynamicColumns,
    { header: 'Question #', key: 'n', width: 11 },
    { header: 'Question', key: 'prompt', width: 50 },
    { header: 'Chosen', key: 'chosen', width: 30 },
    { header: 'Correct', key: 'correct', width: 30 },
    { header: 'Is Correct', key: 'isCorrect', width: 11 },
    { header: 'Points', key: 'points', width: 8 },
  ];
  answers.getRow(1).font = { bold: true };
  for (const s of ordered) {
    quiz.questions.forEach((q, i) => {
      const chosenId = s.answers[q.id];
      const chosen = q.options.find((o) => o.id === chosenId);
      const correct = q.options.find((o) => o.id === q.correctOptionId);
      const row: Record<string, unknown> = {
        id: s.id,
        n: i + 1,
        prompt: q.prompt || (q.promptType === 'image' ? `[image] ${q.imageUrl ?? ''}` : ''),
        chosen: optionLabel(chosen),
        correct: optionLabel(correct),
        isCorrect: chosen ? (chosen.id === q.correctOptionId ? 'YES' : 'NO') : 'BLANK',
        points: q.points,
      };
      for (const f of quiz.examineeFields) row[`ex_${f.fieldId}`] = s.examinee[f.fieldId] ?? '';
      answers.addRow(row).commit();
    });
  }
  answers.commit();

  // --- Sheet 3: summary ------------------------------------------------------
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'k', width: 34 },
    { header: 'Value', key: 'v', width: 40 },
  ];
  summary.getRow(1).font = { bold: true };
  const meta: [string, unknown][] = [
    ['Quiz', quiz.title],
    ['Quiz ID', quiz.id],
    ['Exported At (ISO-8601)', new Date().toISOString()],
    ['Time Limit (s)', quiz.durationSeconds],
    ['Questions', quiz.questions.length],
    ['Max Score', analytics.maxScore],
    ['Submissions', analytics.submissionCount],
    ['Average Score', analytics.averageScore ?? ''],
    ['Average Percent', analytics.averagePercent ?? ''],
    ['Average Duration (s)', analytics.averageDurationSeconds ?? ''],
    ['Manual Submissions', analytics.reasons.manual],
    ['Timed-out Submissions', analytics.reasons.timeout],
    ['Violation Auto-submits', analytics.reasons.violation],
    ['Total Proctor Violations', analytics.totalViolations],
  ];
  for (const [k, v] of meta) summary.addRow({ k, v }).commit();
  summary.addRow({}).commit();
  const head = summary.addRow({ k: 'Question', v: 'Correct Rate (%) · Correct / Answered' });
  head.font = { bold: true };
  head.commit();
  analytics.questions.forEach((q, i) => {
    summary.addRow({ k: `${i + 1}. ${q.prompt}`, v: `${Math.round(q.correctRate * 100)}% · ${q.correct} / ${q.answered}` }).commit();
  });
  summary.commit();

  await workbook.commit();
}
