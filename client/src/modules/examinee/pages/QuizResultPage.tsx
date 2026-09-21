import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShareData } from '@/router/useShareData';
import { WizardSteps } from '../components/WizardSteps';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { useAttemptStore } from '@/store/attempt.store';
import { examineeApi } from '../services/attempt.api';
import { formatClock } from '@/utils/countdown';
import { formatTimestamp } from '@/utils/format';
import { Spinner } from '@/components/Spinner';
import type { SubmissionReceipt, PublicQuestion } from '@/types';
import { examineePaths } from '../hooks/useAttemptRuntime';

const REASON_LABEL: Record<SubmissionReceipt['reason'], string> = {
  manual: 'Submitted by you',
  timeout: 'Auto-submitted when time ran out',
  violation: 'Auto-submitted after proctoring violations',
};

export function Component() {
  const { quiz, token } = useShareData();
  const storedReceipt = useAttemptStore((s) => s.receipt);
  const storedQuestions = useAttemptStore((s) => s.questions);
  const answers = useAttemptStore((s) => s.answers);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(storedReceipt);
  const [questions, setQuestions] = useState<PublicQuestion[]>(storedQuestions);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const store = useAttemptStore.getState();
    const persisted = store.hydrate(token);
    if (persisted?.quizId !== quiz.id) {
      setMissing(true);
      return;
    }
    const load = async () => {
      try {
        const [{ receipt: r }, resumed] = await Promise.all([examineeApi.result(token, persisted.attemptId), examineeApi.resume(token, persisted.attemptId)]);
        store.restore(token, resumed.attempt, resumed.questions, resumed.serverTime, persisted);
        store.setReceipt(r);
        setReceipt(r);
        setQuestions(resumed.questions);
      } catch {
        if (!persisted.receipt) setMissing(true);
      }
    };
    void load();
  }, [token, quiz.id]);

  if (missing) {
    return (
      <main className="page page--center">
        <div className="card card--narrow">
          <h2>No result found</h2>
          <Link className="btn btn--primary" to={examineePaths.entry(token)}>Go to start</Link>
        </div>
      </main>
    );
  }
  if (!receipt) return <Spinner label="Loading your result…" fullscreen />;

  const scoreShown = receipt.score !== null && receipt.maxScore !== null;
  const pct = scoreShown && receipt.maxScore! > 0 ? Math.round((receipt.score! / receipt.maxScore!) * 100) : 0;
  const byQuestion = new Map((receipt.breakdown ?? []).map((b) => [b.questionId, b]));

  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <WizardSteps current={3} />
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h1>{quiz.title}</h1>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {scoreShown ? (
            <div className="stat"><div className="stat__value">{receipt.score}/{receipt.maxScore}</div><div className="stat__label">Score ({pct}%)</div></div>
          ) : (
            <div className="stat"><div className="stat__value">✓</div><div className="stat__label">Submitted</div></div>
          )}
          <div className="stat"><div className="stat__value">{formatClock(receipt.durationSeconds)}</div><div className="stat__label">Time taken</div></div>
          <div className="stat"><div className="stat__value small" style={{ fontSize: '1rem' }}>{formatTimestamp(receipt.submittedAt)}</div><div className="stat__label">Submitted</div></div>
        </div>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>{REASON_LABEL[receipt.reason]}{receipt.needsReview && ' · some answers are awaiting the instructor\'s review'}</p>
      </div>

      {receipt.breakdown ? (
        <div className="stack">
          <h2>Answer key</h2>
          {questions.map((q, i) => (
            <QuestionRenderer key={q.id} question={q} index={i} value={answers[q.id]} result={byQuestion.get(q.id)} />
          ))}
        </div>
      ) : (
        <p className="muted">{scoreShown ? 'The instructor has chosen not to reveal the answer key.' : 'Your response has been recorded. The instructor will share results separately.'}</p>
      )}
    </main>
  );
}
