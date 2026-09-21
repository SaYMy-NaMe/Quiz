import { useEffect, useMemo, useState } from 'react';
import type { GradedQuestionResult, Submission } from '@shared';
import { displayNameFor } from '@shared';
import type { Quiz } from '@/types';
import { dashboardApi } from '../services/dashboard.api';
import { QuestionRenderer } from '@/modules/examinee/components/QuestionRenderer';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { formatDuration, formatPercent, formatTimestamp } from '@/utils/format';
import { HttpError } from '@/utils/api';

interface Props {
  quiz: Quiz;
  /** Bumped by the parent when new submissions are observed, to refetch. */
  version: number;
  onGraded?: () => void;
}

const REASON: Record<Submission['reason'], string> = { manual: 'Manual', timeout: 'Timed out', violation: 'Violation' };
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Re-derives the per-question outcome locally (the instructor holds the answer keys). */
function review(quiz: Quiz, s: Submission): Map<string, GradedQuestionResult> {
  return new Map(
    quiz.questions.map((q): [string, GradedQuestionResult] => {
      const raw = s.answers[q.id];
      const answer = raw !== undefined && raw !== '' ? raw : null;
      const base: GradedQuestionResult = { questionId: q.id, answer, correctOptionId: null, acceptedAnswers: null, points: q.points, needsReview: false, correct: false, earned: 0 };
      if (q.type === 'mcq') {
        const correct = answer !== null && answer === q.correctOptionId;
        return [q.id, { ...base, correctOptionId: q.correctOptionId ?? null, correct, earned: correct ? q.points : 0 }];
      }
      if (q.acceptedAnswers?.length) {
        const correct = answer !== null && q.acceptedAnswers.some((a) => normalize(a) === normalize(answer));
        return [q.id, { ...base, acceptedAnswers: q.acceptedAnswers, correct, earned: correct ? q.points : 0 }];
      }
      const manual = s.manualScores[q.id];
      return [q.id, { ...base, correct: manual !== undefined && manual >= q.points, earned: manual ?? 0, needsReview: manual === undefined && answer !== null }];
    }),
  );
}

/** Instructor response viewer with inline manual grading for text questions. */
export function ResponsesPanel({ quiz, version, onGraded }: Props) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [query, setQuery] = useState('');
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void dashboardApi.submissions(quiz.id).then((r) => {
      if (!cancelled) setSubmissions(r.submissions);
    });
    return () => {
      cancelled = true;
    };
  }, [quiz.id, version]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (submissions ?? []).filter((s) => !q || Object.values(s.examinee).some((v) => String(v).toLowerCase().includes(q)));
  }, [submissions, query]);

  const manualQuestions = quiz.questions.filter((q) => q.type !== 'mcq' && !q.acceptedAnswers?.length);
  const outcome = useMemo(() => (selected ? review(quiz, selected) : new Map<string, GradedQuestionResult>()), [selected, quiz]);

  const open = (s: Submission) => {
    setSelected(s);
    setError(null);
    setGrades(Object.fromEntries(manualQuestions.map((q) => [q.id, s.manualScores[q.id] !== undefined ? String(s.manualScores[q.id]) : ''])));
  };

  const saveGrades = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(grades).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
      const { submission } = await dashboardApi.grade(quiz.id, selected.id, payload);
      setSubmissions((list) => (list ?? []).map((s) => (s.id === submission.id ? submission : s)));
      setSelected(submission);
      onGraded?.();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save grades');
    } finally {
      setSaving(false);
    }
  };

  if (!submissions) return <Spinner label="Loading responses…" />;
  if (submissions.length === 0) return <div className="alert alert--info">No responses yet.</div>;

  return (
    <div className="stack">
      <div className="row row--between">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Filter by any examinee field…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter responses" />
        <span className="small muted">{rows.length} of {submissions.length} responses · {submissions.filter((s) => s.needsReview).length} awaiting review</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {quiz.examineeFields.map((f) => <th key={f.fieldId} scope="col">{f.label}</th>)}
              {quiz.examineeFields.length === 0 && <th scope="col">Examinee</th>}
              <th scope="col">Score</th>
              <th scope="col">Duration</th>
              <th scope="col">Submitted</th>
              <th scope="col">Violations</th>
              <th scope="col">Reason</th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                {quiz.examineeFields.map((f) => <td key={f.fieldId}>{s.examinee[f.fieldId] ?? '—'}</td>)}
                {quiz.examineeFields.length === 0 && <td>{displayNameFor([], s.examinee)}</td>}
                <td>
                  <strong>{s.score}</strong> / {s.maxScore} <span className="muted small">({formatPercent(s.score, s.maxScore)})</span>
                  {s.needsReview && <span className="badge badge--draft" style={{ marginLeft: 6 }}>review</span>}
                </td>
                <td>{formatDuration(s.durationSeconds)}</td>
                <td className="small muted">{formatTimestamp(s.submittedAt)}</td>
                <td>{s.violations > 0 ? <span className="badge badge--closed">{s.violations}</span> : '0'}</td>
                <td className="small">{REASON[s.reason]}</td>
                <td><button className="btn btn--sm" onClick={() => open(s)}>{s.needsReview ? 'Grade' : 'View'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal wide title={`Response · ${displayNameFor(quiz.examineeFields, selected.examinee)}`} onClose={() => setSelected(null)}>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-grid small" style={{ marginBottom: '0.75rem' }}>
              {quiz.examineeFields.map((f) => <div key={f.fieldId}><span className="muted">{f.label}:</span> {selected.examinee[f.fieldId] ?? '—'}</div>)}
              <div><span className="muted">Score:</span> {selected.score} / {selected.maxScore}</div>
              <div><span className="muted">Duration:</span> {formatDuration(selected.durationSeconds)}</div>
              <div><span className="muted">Submitted:</span> {formatTimestamp(selected.submittedAt)}</div>
              <div><span className="muted">Reason:</span> {REASON[selected.reason]} · {selected.violations} violation{selected.violations === 1 ? '' : 's'}</div>
            </div>
            <div className="stack">
              {quiz.questions.map((qn, i) => (
                <div key={qn.id}>
                  <QuestionRenderer question={qn} index={i} value={selected.answers[qn.id]} result={outcome.get(qn.id)} />
                  {manualQuestions.some((m) => m.id === qn.id) && (
                    <label className="row small" style={{ marginTop: '0.4rem' }}>
                      Points awarded (0–{qn.points})
                      <input type="number" className="input" style={{ width: 90 }} min={0} max={qn.points} step={0.5} value={grades[qn.id] ?? ''} onChange={(e) => setGrades((g) => ({ ...g, [qn.id]: e.target.value }))} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
          {error && <div className="alert alert--error" role="alert" style={{ marginTop: '0.75rem' }}>{error}</div>}
          <div className="row row--end" style={{ marginTop: '0.75rem' }}>
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
            {manualQuestions.length > 0 && (
              <button className="btn btn--primary" disabled={saving} onClick={() => void saveGrades()}>{saving ? 'Saving…' : 'Save grades'}</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
