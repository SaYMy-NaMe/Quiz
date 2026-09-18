import type { Leaderboard } from '@shared';
import { RankBadge } from './RankBadge';
import { formatDuration, formatTimestamp, formatPercent } from '@/utils/format';

interface Props {
  board: Leaderboard;
  /** Extra examinee columns to show (instructor view). */
  extraColumns?: { fieldId: string; label: string }[];
  highlightSubmissionId?: string | null;
}

export function LeaderboardTable({ board, extraColumns = [], highlightSubmissionId = null }: Props) {
  if (board.entries.length === 0) {
    return <div className="alert alert--info">No submissions yet.</div>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Examinee</th>
            {extraColumns.map((c) => (
              <th scope="col" key={c.fieldId}>{c.label}</th>
            ))}
            <th scope="col">Score</th>
            <th scope="col">Duration</th>
            <th scope="col">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {board.entries.map((e) => (
            <tr key={e.submissionId} style={e.submissionId === highlightSubmissionId ? { background: 'var(--primary-soft)' } : undefined}>
              <td><RankBadge rank={e.rank} /></td>
              <td>
                <strong>{e.displayName}</strong>
                {e.submissionId === highlightSubmissionId && <span className="badge" style={{ marginLeft: 6 }}>You</span>}
              </td>
              {extraColumns.map((c) => (
                <td key={c.fieldId}>{e.examinee[c.fieldId] ?? '—'}</td>
              ))}
              <td>
                <strong>{e.score}</strong> / {e.maxScore} <span className="muted small">({formatPercent(e.score, e.maxScore)})</span>
              </td>
              <td>{formatDuration(e.durationSeconds)}</td>
              <td className="small muted">{formatTimestamp(e.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
