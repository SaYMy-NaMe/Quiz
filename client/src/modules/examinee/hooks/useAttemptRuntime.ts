import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttemptStore } from '@/modules/quiz/store/attempt.store';
import { useTimerStore } from '@/modules/quiz/store/timer.store';
import { attemptApi } from '../services/attempt.api';
import { submissionApi } from '../services/submission.api';
import type { SubmissionReason } from '@/modules/quiz/types';

export const examineePaths = {
  entry: (token: string, invite: string | null) => `/quiz/v/${token}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
  test: (token: string, invite: string | null) => `/quiz/v/${token}/test${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
  result: (token: string, invite: string | null) => `/quiz/v/${token}/result${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
};

type Phase = 'loading' | 'ready' | 'submitting' | 'done' | 'missing';

/**
 * Orchestrates the timed test: hydrates/resumes the attempt, wires the
 * countdown observer to auto-submit, and exposes a single idempotent `submit`.
 */
export function useAttemptRuntime(token: string, invite: string | null, quizId: string) {
  const navigate = useNavigate();
  const store = useAttemptStore();
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submit = useCallback(
    async (reason: SubmissionReason) => {
      const { attempt, answers, receipt } = useAttemptStore.getState();
      if (!attempt || receipt || submittingRef.current) return;
      submittingRef.current = true;
      setPhase('submitting');
      stopTimer();
      try {
        const { receipt: r } = await submissionApi.submit(token, attempt.id, answers, reason, invite);
        useAttemptStore.getState().setReceipt(r);
        setPhase('done');
        navigate(examineePaths.result(token, invite), { replace: true });
      } catch {
        submittingRef.current = false;
        setPhase('ready');
        setError('Submission failed. Check your connection and try again — your answers are saved on this device.');
      }
    },
    [token, invite, navigate, stopTimer],
  );

  useEffect(() => {
    let cancelled = false;
    const persisted = store.hydrate(token);
    if (!persisted || persisted.quizId !== quizId) {
      setPhase('missing');
      return;
    }
    if (persisted.receipt) {
      navigate(examineePaths.result(token, invite), { replace: true });
      return;
    }
    // Always re-sync against the server: it owns the deadline.
    void attemptApi
      .resume(token, persisted.attemptId, invite)
      .then((res) => {
        if (cancelled) return;
        store.restore(token, res.attempt, res.questions, res.serverTime, persisted);
        if (res.attempt.status === 'submitted') {
          void submissionApi.result(token, res.attempt.id, invite).then(({ receipt }) => {
            store.setReceipt(receipt);
            navigate(examineePaths.result(token, invite), { replace: true });
          });
          return;
        }
        startTimer({
          expiresAt: res.attempt.expiresAt,
          startedAt: res.attempt.startedAt,
          clockOffsetMs: useAttemptStore.getState().clockOffsetMs,
          onExpire: () => void submit('timeout'),
        });
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('missing');
      });
    return () => {
      cancelled = true;
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, invite, quizId]);

  return { phase, error, submit, clearError: () => setError(null) };
}
