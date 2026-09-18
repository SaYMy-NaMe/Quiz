import { useState } from 'react';
import type { Quiz } from '@/types';
import { quizApi } from '@/modules/builder/services/quiz.api';
import { HttpError } from '@/utils/api';

interface Props {
  quiz: Quiz;
  onChange: (quiz: Quiz) => void;
}

/** Drives the server-side quiz state machine (draft → published → closed). */
export function LifecycleActions({ quiz, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ quiz: Quiz }>) => {
    setBusy(true);
    setError(null);
    try {
      onChange((await fn()).quiz);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: '0.5rem' }}>
      <div className="row">
        {quiz.status === 'draft' && (
          <button className="btn btn--primary" disabled={busy || quiz.questions.length === 0} onClick={() => void run(() => quizApi.publish(quiz.id))}>
            Publish &amp; generate link
          </button>
        )}
        {quiz.status === 'published' && (
          <>
            <button className="btn" disabled={busy} onClick={() => void run(() => quizApi.close(quiz.id))}>Close submissions</button>
            <button className="btn btn--ghost" disabled={busy} onClick={() => void run(() => quizApi.unpublish(quiz.id))}>Unpublish to edit</button>
          </>
        )}
        {quiz.status === 'closed' && (
          <button className="btn btn--primary" disabled={busy} onClick={() => void run(() => quizApi.reopen(quiz.id))}>Reopen</button>
        )}
      </div>
      {quiz.status === 'draft' && quiz.questions.length === 0 && <span className="small muted">Add at least one question before publishing.</span>}
      {error && <div className="alert alert--error" role="alert">{error}</div>}
    </div>
  );
}
