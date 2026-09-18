import { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';
import { WizardSteps } from '../components/WizardSteps';
import { McqRenderer } from '@/modules/quiz/components/McqRenderer';
import { useAttemptStore } from '@/modules/quiz/store/attempt.store';
import { attemptApi } from '../services/attempt.api';
import { submissionApi } from '../services/submission.api';
import { formatClock } from '@/modules/quiz/services/countdown';
import { formatTimestamp } from '@/utils/format';
import { Spinner } from '@/components/Spinner';
import type { SubmissionReceipt, PublicQuestion } from '@/modules/quiz/types';
import { examineePaths } from '../hooks/useAttemptRuntime';

const REASON_LABEL: Record<SubmissionReceipt['reason'], string> = {
  manual: 'Submitted by you',
  timeout: 'Auto-submitted when time ran out',
  violation: 'Auto-submitted after proctoring violations',
};

export function Component() {
  const { quiz, token, invite } = useLoaderData() as ShareLoaderData;
  const store = useAttemptStore();
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(store.receipt);
  const [questions, setQuestions] = useState<PublicQuestion[]>(store.questions);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const persisted = store.hydrate(token);
    if (!persisted || persisted.quizId !== quiz.id) {
      setMissing(true);
      return;
    }
    const load = async () => {
      try {
        const [{ receipt: r }, resumed] = await Promise.all([
          submissionApi.result(token, persisted.attemptId, invite),
          attemptApi.resume(token, persisted.attemptId, invite),
        ]);
        store.restore(token, resumed.attempt, resumed.questions, resumed.serverTime, persisted);
        store.setReceipt(r);
        setReceipt(r);
        setQuestions(resumed.questions);
      } catch {
        if (!persisted.receipt) setMissing(true);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, invite, quiz.id]);

  if (missing) {
    return (
      <main className="page page--center">
        <div className="card card--narrow">
          <h2>No result found</h2>
          <Link className="btn btn--primary" to={examineePaths.entry(token, invite)}>Go to start</Link>
        </div>
      </main>
    );
  }
  if (!receipt) return <Spinner label="Loading your result…" fullscreen />;

  const pct = receipt.maxScore > 0 ? Math.round((receipt.score / receipt.maxScore) * 100) : 0;
  const byQuestion = new Map((receipt.breakdown ?? []).map((b) => [b.questionId, b]));

  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <WizardSteps current={3} />
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h1>{quiz.title}</h1>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="stat"><div className="stat__value">{receipt.score}/{receipt.maxScore}</div><div className="stat__label">Score ({pct}%)</div></div>
          <div className="stat"><div className="stat__value">{formatClock(receipt.durationSeconds)}</div><div className="stat__label">Time taken</div></div>
          <div className="stat"><div className="stat__value small" style={{ fontSize: '1rem' }}>{formatTimestamp(receipt.submittedAt)}</div><div className="stat__label">Submitted</div></div>
        </div>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>{REASON_LABEL[receipt.reason]}</p>
        {quiz.leaderboardVisible && (
          <Link className="btn" to={`/quiz/v/${token}/leaderboard${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`}>View leaderboard</Link>
        )}
      </div>

      {receipt.breakdown ? (
        <div className="stack">
          <h2>Answer key</h2>
          {questions.map((q, i) => (
            <McqRenderer key={q.id} question={q} index={i} selected={store.answers[q.id]} result={byQuestion.get(q.id)} />
          ))}
        </div>
      ) : (
        <p className="muted">The instructor has chosen not to reveal the answer key.</p>
      )}
    </main>
  );
}
