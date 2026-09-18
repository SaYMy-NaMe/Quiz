import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttemptStore } from '@/store/attempt.store';
import { useTimerStore } from '@/store/timer.store';
import { attemptApi } from '../services/attempt.api';
import { submissionApi } from '../services/submission.api';
import type { SubmissionReason } from '@/types';
import { HttpError } from '@/services/http';

const withInvite = (path: string, invite: string | null) => `${path}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

export const examineePaths = {
  entry: (token: string, invite: string | null) => withInvite(`/quiz/v/${token}`, invite),
  test: (token: string, invite: string | null) => withInvite(`/quiz/v/${token}/test`, invite),
  result: (token: string, invite: string | null) => withInvite(`/quiz/v/${token}/result`, invite),
};

/**
 * Exam lifecycle (State Pattern, client side):
 *   loading → gate (pending examinee, no attempt yet) → starting → running → submitting → done
 *                                                                 ↘ missing (nothing to resume)
 */
export type Phase = 'loading' | 'gate' | 'starting' | 'running' | 'submitting' | 'done' | 'missing';

interface Options {
  /** Called inside the Start-Quiz click so fullscreen can be requested within the user gesture. */
  beforeStart?: () => Promise<void>;
}

/**
 * Orchestrates Step 2: resumes a persisted attempt (server clock authoritative),
 * or waits at the gate until "Start Quiz" opens a new attempt; wires the countdown
 * observer to auto-submit; exposes a single idempotent `submit`.
 */
export function useAttemptRuntime(token: string, invite: string | null, quizId: string, { beforeStart }: Options = {}) {
  const navigate = useNavigate();
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
        // Browser controls unlock immediately upon submission.
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
        navigate(examineePaths.result(token, invite), { replace: true });
      } catch {
        submittingRef.current = false;
        setPhase('running');
        setError('Submission failed. Check your connection and try again — your answers are saved on this device.');
      }
    },
    [token, invite, navigate, stopTimer],
  );

  const runTimer = useCallback(
    (expiresAt: string, startedAt: string) => {
      startTimer({
        expiresAt,
        startedAt,
        clockOffsetMs: useAttemptStore.getState().clockOffsetMs,
        onExpire: () => void submit('timeout'),
      });
    },
    [startTimer, submit],
  );

  /** "Start Quiz": opens the attempt on the server — this is the moment the timer starts. */
  const start = useCallback(async () => {
    const store = useAttemptStore.getState();
    const pending = store.getPendingExaminee(token, quizId);
    if (!pending) {
      setPhase('missing');
      return;
    }
    setPhase('starting');
    setError(null);
    try {
      await beforeStart?.();
      const started = await attemptApi.start(token, pending, invite);
      store.begin(token, started.attempt, started.questions, started.serverTime);
      store.clearPendingExaminee(token);
      runTimer(started.attempt.expiresAt, started.attempt.startedAt);
      setPhase('running');
    } catch (err) {
      if (err instanceof HttpError && err.status === 400) {
        // Metadata no longer validates (schema changed): send them back to Step 1.
        store.clearPendingExaminee(token);
        navigate(examineePaths.entry(token, invite), { replace: true });
        return;
      }
      setPhase('gate');
      setError(err instanceof HttpError && err.status === 404 ? 'This quiz is no longer accepting responses.' : 'Could not start the exam. Please try again.');
    }
  }, [token, invite, quizId, beforeStart, runTimer, navigate]);

  useEffect(() => {
    let cancelled = false;
    const store = useAttemptStore.getState();
    const persisted = store.hydrate(token);

    if (persisted?.quizId !== quizId) {
      setPhase(store.getPendingExaminee(token, quizId) ? 'gate' : 'missing');
      return;
    }
    if (persisted.receipt) {
      navigate(examineePaths.result(token, invite), { replace: true });
      return;
    }
    // Always re-sync against the server: it owns the deadline, so a refresh can't reset the clock.
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
        runTimer(res.attempt.expiresAt, res.attempt.startedAt);
        setPhase('running');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // The server no longer knows this attempt (quiz deleted/reset): drop the stale local copy
        // so the entry page doesn't bounce back here forever.
        if (err instanceof HttpError && err.status === 404) store.clear(token);
        setPhase('missing');
      });
    return () => {
      cancelled = true;
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, invite, quizId]);

  return { phase, error, start, submit, clearError: () => setError(null) };
}
