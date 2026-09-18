import type { QuizAnalytics } from '@shared';
import type { Quiz } from '@/modules/quiz/types';
import { StatTile } from './StatTile';
import { formatDuration, formatPercent } from '@/utils/format';

interface Props {
  quiz: Quiz;
  analytics: QuizAnalytics;
}

export function AnalyticsPanel({ quiz, analytics: a }: Props) {
  const optionText = new Map(quiz.questions.flatMap((q) => q.options.map((o) => [o.id, o.text] as const)));
  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatTile value={a.submissionCount} label="Responses" />
        <StatTile value={a.averageScore !== null ? `${a.averageScore}/${a.maxScore}` : '—'} label={`Average score${a.averagePercent !== null ? ` (${a.averagePercent}%)` : ''}`} />
        <StatTile value={a.highestScore ?? '—'} label="Highest" />
        <StatTile value={a.lowestScore ?? '—'} label="Lowest" />
        <StatTile value={a.averageDurationSeconds !== null ? formatDuration(a.averageDurationSeconds) : '—'} label="Avg. duration" />
        <StatTile value={a.totalViolations} label="Proctor violations" />
      </div>
      <div className="row small muted" style={{ gap: '1rem' }}>
        <span>Manual: {a.reasons.manual}</span>
        <span>Timed out: {a.reasons.timeout}</span>
        <span>Violation auto-submits: {a.reasons.violation}</span>
      </div>

      <h3>Per-question performance</h3>
      {a.questions.length === 0 ? (
        <p className="muted">No questions.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Answered</th>
                <th>Correct</th>
                <th>Correct rate</th>
                <th>Most chosen</th>
              </tr>
            </thead>
            <tbody>
              {a.questions.map((q, i) => {
                const top = Object.entries(q.distribution).sort((x, y) => y[1] - x[1])[0];
                return (
                  <tr key={q.questionId}>
                    <td>{i + 1}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>{q.prompt}</td>
                    <td>{q.answered}</td>
                    <td>{q.correct}</td>
                    <td>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <div className="progress" style={{ width: 90 }}><div className="progress__bar" style={{ width: `${Math.round(q.correctRate * 100)}%`, background: q.correctRate < 0.5 ? 'var(--danger)' : 'var(--success)' }} /></div>
                        <span>{formatPercent(q.correct, a.submissionCount)}</span>
                      </div>
                    </td>
                    <td className="small">{top && top[1] > 0 ? `${optionText.get(top[0]) ?? '?'} (${top[1]})` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
