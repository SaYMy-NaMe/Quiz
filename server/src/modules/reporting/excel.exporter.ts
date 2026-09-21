import ExcelJS from 'exceljs';
import type { Writable } from 'node:stream';
import type { Leaderboard, Quiz, QuizAnalytics, Submission } from '@shared';

export interface ExportInput {
  quiz: Quiz;
  submissions: Submission[];
  leaderboard: Leaderboard;
  analytics: QuizAnalytics;
}

export const formatHms = (seconds: number): string =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, '0')).join(':');

export const safeFilename = (title: string): string =>
  title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || 'quiz';

/**
 * Streams a workbook straight into the HTTP response (flat memory for any submission count).
 *   Submissions: Rank | <examinee fields…> | Score | Max | % | Needs Review | Time Taken | Started/Submitted (ISO-8601) | Violations | Reason
 *   Answers:     one row per (submission, question) — option text for MCQs, free text otherwise
 *   Summary:     metadata + per-question correct rates
 */
export async function writeSubmissionsWorkbook(out: Writable, { quiz, submissions, leaderboard, analytics }: ExportInput): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true, useSharedStrings: true });
  workbook.creator = 'Quiz Platform';
  const rankOf = new Map(leaderboard.entries.map((e) => [e.submissionId, e.rank]));
  const byId = new Map(submissions.map((s) => [s.id, s]));
  const ordered = leaderboard.entries.flatMap((e) => byId.get(e.submissionId) ?? []);
  const examineeColumns = quiz.examineeFields.map((f) => ({ header: f.label, key: `ex_${f.fieldId}`, width: Math.max(14, Math.min(40, f.label.length + 4)) }));
  const examineeCells = (s: Submission) => Object.fromEntries(quiz.examineeFields.map((f) => [`ex_${f.fieldId}`, s.examinee[f.fieldId] ?? '']));

  const sheet = workbook.addWorksheet('Submissions', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Rank', key: 'rank', width: 8 },
    ...examineeColumns,
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Max Score', key: 'maxScore', width: 11 },
    { header: 'Percent', key: 'percent', width: 10 },
    { header: 'Needs Review', key: 'needsReview', width: 13 },
    { header: 'Time Taken (s)', key: 'durationSeconds', width: 15 },
    { header: 'Time Taken (hh:mm:ss)', key: 'durationHms', width: 21 },
    { header: 'Started At (ISO-8601)', key: 'startedAt', width: 26 },
    { header: 'Submitted At (ISO-8601)', key: 'submittedAt', width: 26 },
    { header: 'Violations', key: 'violations', width: 11 },
    { header: 'Reason', key: 'reason', width: 12 },
    { header: 'Submission ID', key: 'id', width: 26 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const s of ordered) {
    sheet
      .addRow({
        rank: rankOf.get(s.id) ?? null,
        ...examineeCells(s),
        score: s.score,
        maxScore: s.maxScore,
        percent: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 10000) / 100 : 0,
        needsReview: s.needsReview ? 'YES' : '',
        durationSeconds: s.durationSeconds,
        durationHms: formatHms(s.durationSeconds),
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        violations: s.violations,
        reason: s.reason,
        id: s.id,
      })
      .commit();
  }
  sheet.commit();

  const answers = workbook.addWorksheet('Answers', { views: [{ state: 'frozen', ySplit: 1 }] });
  answers.columns = [
    { header: 'Submission ID', key: 'id', width: 26 },
    ...examineeColumns,
    { header: 'Question #', key: 'n', width: 11 },
    { header: 'Type', key: 'type', width: 8 },
    { header: 'Question', key: 'prompt', width: 50 },
    { header: 'Answer', key: 'answer', width: 40 },
    { header: 'Correct Answer', key: 'correct', width: 30 },
    { header: 'Result', key: 'result', width: 10 },
    { header: 'Earned', key: 'earned', width: 8 },
    { header: 'Points', key: 'points', width: 8 },
  ];
  answers.getRow(1).font = { bold: true };
  for (const s of ordered) {
    quiz.questions.forEach((q, i) => {
      const raw = s.answers[q.id];
      const chosen = q.type === 'mcq' ? q.options.find((o) => o.id === raw) : undefined;
      const key = q.type === 'mcq' ? q.options.find((o) => o.id === q.correctOptionId) : undefined;
      const manual = s.manualScores[q.id];
      const label = (o: { text: string; imageUrl?: string } | undefined) => (o ? o.text || `[image] ${o.imageUrl ?? ''}` : '');
      answers
        .addRow({
          id: s.id,
          ...examineeCells(s),
          n: i + 1,
          type: q.type,
          prompt: q.prompt || (q.promptType === 'image' ? `[image] ${q.imageUrl ?? ''}` : ''),
          answer: q.type === 'mcq' ? label(chosen) : (raw ?? ''),
          correct: q.type === 'mcq' ? label(key) : (q.acceptedAnswers ?? []).join(' | '),
          result: !raw ? 'BLANK' : q.type === 'mcq' ? (chosen?.id === q.correctOptionId ? 'YES' : 'NO') : manual !== undefined ? 'GRADED' : q.acceptedAnswers?.length ? 'AUTO' : 'PENDING',
          earned: q.type === 'mcq' ? (chosen?.id === q.correctOptionId ? q.points : 0) : (manual ?? ''),
          points: q.points,
        })
        .commit();
    });
  }
  answers.commit();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ header: 'Metric', key: 'k', width: 34 }, { header: 'Value', key: 'v', width: 40 }];
  summary.getRow(1).font = { bold: true };
  const meta: [string, unknown][] = [
    ['Quiz', quiz.title],
    ['Quiz ID', quiz.id],
    ['Exported At (ISO-8601)', new Date().toISOString()],
    ['Time Limit (s)', quiz.settings.durationSeconds],
    ['Questions', quiz.questions.length],
    ['Max Score', analytics.maxScore],
    ['Submissions', analytics.submissionCount],
    ['Pending Manual Review', analytics.pendingReview],
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
  analytics.questions.forEach((q, i) => summary.addRow({ k: `${i + 1}. ${q.prompt}`, v: `${Math.round(q.correctRate * 100)}% · ${q.correct} / ${q.answered}` }).commit());
  summary.commit();

  await workbook.commit();
}
