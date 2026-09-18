import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { QuizAnalytics } from '@shared';
import { Navbar } from '@/components/Navbar';
import { Spinner } from '@/components/Spinner';
import { quizApi } from '@/modules/quiz/services/quiz.api';
import type { Quiz } from '@/modules/quiz/types';
import { ShareLinkPanel } from '@/modules/share';
import { leaderboardApi, useLeaderboard, LeaderboardTable, VisibilityToggle } from '@/modules/leaderboard';
import { ExportButton } from '@/modules/reporting';
import { dashboardApi } from '../services/dashboard.api';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { LifecycleActions } from '../components/LifecycleActions';
import { DeleteQuizModal } from '../components/DeleteQuizModal';
import { formatDuration } from '@/utils/format';

type Tab = 'share' | 'leaderboard' | 'analytics';

export function Component() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [tab, setTab] = useState<Tab>('share');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const board = useLeaderboard(useCallback(() => leaderboardApi.forQuiz(id), [id]), { pollMs: 15_000 });

  useEffect(() => {
    let cancelled = false;
    Promise.all([quizApi.get(id), dashboardApi.analytics(id)])
      .then(([q, a]) => {
        if (cancelled) return;
        setQuiz(q.quiz);
        setAnalytics(a.analytics);
      })
      .catch(() => navigate('/dashboard', { replace: true }));
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // Refresh analytics whenever the leaderboard poll observes a new submission.
  const entryCount = board.board?.entries.length ?? -1;
  useEffect(() => {
    if (entryCount < 0) return;
    void dashboardApi.analytics(id).then((a) => setAnalytics(a.analytics)).catch(() => undefined);
  }, [entryCount, id]);

  if (!quiz || !analytics) {
    return (
      <>
        <Navbar />
        <Spinner label="Loading quiz…" fullscreen />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page page--wide">
        <nav className="small muted" aria-label="Breadcrumb" style={{ marginBottom: '0.5rem' }}>
          <Link to="/dashboard">Dashboard</Link> / {quiz.title}
        </nav>
        <div className="row row--between" style={{ alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{quiz.title}</h1>
            <div className="row" style={{ gap: '0.4rem' }}>
              <span className={`badge badge--${quiz.status}`}>{quiz.status}</span>
              <span className={`badge badge--${quiz.accessMode}`}>{quiz.accessMode}</span>
              <span className="small muted">{quiz.questions.length} questions · {formatDuration(quiz.durationSeconds)} · {quiz.revealAnswers ? 'answers revealed' : 'answers hidden'}</span>
            </div>
          </div>
          <div className="row">
            <Link className="btn" to={`/dashboard/quizzes/${quiz.id}/edit`}>Edit</Link>
            <ExportButton quizId={quiz.id} disabled={analytics.submissionCount === 0} />
            <button className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <LifecycleActions quiz={quiz} onChange={setQuiz} />
        </div>

        <div className="tabs" role="tablist">
          {(
            [
              ['share', 'Share'],
              ['leaderboard', `Leaderboard (${board.board?.entries.length ?? 0})`],
              ['analytics', 'Analytics'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={`tab ${tab === key ? 'tab--active' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'share' && (
          <div className="card">
            <ShareLinkPanel quiz={quiz} />
          </div>
        )}
        {tab === 'leaderboard' && (
          <div className="stack">
            <div className="card card--flat">
              <VisibilityToggle quiz={quiz} onChange={setQuiz} />
            </div>
            {board.loading && <Spinner label="Loading leaderboard…" />}
            {board.board && (
              <LeaderboardTable board={board.board} extraColumns={quiz.examineeFields.map((f) => ({ fieldId: f.fieldId, label: f.label }))} />
            )}
            <div className="row row--end">
              <button className="btn btn--sm" onClick={() => void board.refresh()}>Refresh</button>
            </div>
          </div>
        )}
        {tab === 'analytics' && <AnalyticsPanel quiz={quiz} analytics={analytics} />}
      </main>
      {confirmDelete && (
        <DeleteQuizModal
          quizId={quiz.id}
          title={quiz.title}
          submissionCount={analytics.submissionCount}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => navigate('/dashboard', { replace: true })}
        />
      )}
    </>
  );
}
