import { Link, useLoaderData } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';
import { leaderboardApi } from '../services/leaderboard.api';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { useAttemptStore } from '@/modules/quiz/store/attempt.store';
import { Spinner } from '@/components/Spinner';
import { formatTimestamp } from '@/utils/format';

export function Component() {
  const { quiz, token, invite } = useLoaderData() as ShareLoaderData;
  const { board, error, loading } = useLeaderboard((signal) => leaderboardApi.forShare(token, invite, signal), { pollMs: 10_000 });
  const mine = useAttemptStore((s) => s.receipt?.submissionId ?? s.hydrate(token)?.receipt?.submissionId ?? null);
  const back = `/quiz/v/${token}/result${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <div className="row row--between">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted">{quiz.title}</p>
        </div>
        <Link className="btn" to={back}>Back to my result</Link>
      </div>
      {loading && <Spinner label="Loading rankings…" />}
      {error && (
        <div className="alert alert--warning" role="alert">
          {error.status === 403 ? 'The instructor has hidden the leaderboard for this quiz.' : error.message}
        </div>
      )}
      {board && (
        <>
          <LeaderboardTable board={board} highlightSubmissionId={mine} />
          <p className="small muted" style={{ marginTop: '0.5rem' }}>
            Ranked by score, then fastest time, then earliest submission · updated {formatTimestamp(board.generatedAt)}
          </p>
        </>
      )}
    </main>
  );
}
