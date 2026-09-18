import { useEffect, useMemo, useState } from 'react';
import type { GradedQuestionResult, Submission } from '@shared';
import type { Quiz } from '@/types';
import { dashboardApi } from '../services/dashboard.api';
import { McqRenderer } from '@/modules/examinee/components/McqRenderer';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { formatDuration, formatPercent, formatTimestamp } from '@/utils/format';
import { displayNameFor } from '@shared';

interface Props {
  quiz: Quiz;
  /** Bumped by the parent when new submissions are observed, to refetch. */
  version: number;
}

const REASON: Record<Submission['reason'], string> = { manual: 'Manual', timeout: 'Timed out', violation: 'Violation' };

/** Instructor response viewer: one row per submission, with a full per-question review. */
export function ResponsesPanel({ quiz, version }: Props) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [query, setQuery] = useState('');

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
    const list = submissions ?? [];
    return q ? list.filter((s) => Object.values(s.examinee).some((v) => String(v).toLowerCase().includes(q))) : list;
  }, [submissions, query]);

  // The instructor holds the full quiz (with the key), so the review is computed locally.
  const review = useMemo(() => {
    if (!selected) return new Map<string, GradedQuestionResult>();
    return new Map(
      quiz.questions.map((qn) => {
        const chosen = selected.answers[qn.id] ?? null;
        const valid = chosen !== null && qn.options.some((o) => o.id === chosen);
        const correct = valid && chosen === qn.correctOptionId;
        return [qn.id, { questionId: qn.id, chosenOptionId: valid ? chosen : null, correctOptionId: qn.correctOptionId, correct, points: qn.points, earned: correct ? qn.points : 0 }];
      }),
    );
  }, [selected, quiz.questions]);

  if (!submissions) return <Spinner label="Loading responses…" />;
  if (submissions.length === 0) return <div className="alert alert--info">No responses yet.</div>;

  return (
    <div className="stack">
      <div className="row row--between">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Filter by any examinee field…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter responses" />
        <span className="small muted">{rows.length} of {submissions.length} responses</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {quiz.examineeFields.map((f) => (
                <th key={f.fieldId} scope="col">{f.label}</th>
              ))}
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
                {quiz.examineeFields.map((f) => (
                  <td key={f.fieldId}>{s.examinee[f.fieldId] ?? '—'}</td>
                ))}
                {quiz.examineeFields.length === 0 && <td>{displayNameFor([], s.examinee)}</td>}
                <td><strong>{s.score}</strong> / {s.maxScore} <span className="muted small">({formatPercent(s.score, s.maxScore)})</span></td>
                <td>{formatDuration(s.durationSeconds)}</td>
                <td className="small muted">{formatTimestamp(s.submittedAt)}</td>
                <td>{s.violations > 0 ? <span className="badge badge--closed">{s.violations}</span> : '0'}</td>
                <td className="small">{REASON[s.reason]}</td>
                <td><button className="btn btn--sm" onClick={() => setSelected(s)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal wide title={`Response · ${displayNameFor(quiz.examineeFields, selected.examinee)}`} onClose={() => setSelected(null)}>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="form-grid small" style={{ marginBottom: '0.75rem' }}>
              {quiz.examineeFields.map((f) => (
                <div key={f.fieldId}><span className="muted">{f.label}:</span> {selected.examinee[f.fieldId] ?? '—'}</div>
              ))}
              <div><span className="muted">Score:</span> {selected.score} / {selected.maxScore}</div>
              <div><span className="muted">Duration:</span> {formatDuration(selected.durationSeconds)}</div>
              <div><span className="muted">Submitted:</span> {formatTimestamp(selected.submittedAt)}</div>
              <div><span className="muted">Reason:</span> {REASON[selected.reason]} · {selected.violations} violation{selected.violations === 1 ? '' : 's'}</div>
            </div>
            <div className="stack">
              {quiz.questions.map((qn, i) => (
                <McqRenderer key={qn.id} question={qn} index={i} selected={selected.answers[qn.id]} result={review.get(qn.id)} />
              ))}
            </div>
          </div>
          <div className="row row--end" style={{ marginTop: '0.75rem' }}>
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
