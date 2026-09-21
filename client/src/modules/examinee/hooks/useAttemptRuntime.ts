import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttemptStore } from '@/store/attempt.store';
import { useTimerStore } from '@/store/timer.store';
import { examineeApi } from '../services/attempt.api';
import type { SubmissionReason } from '@/types';
import { HttpError } from '@/utils/api';

export const examineePaths = {
  entry: (token: string) => `/quiz/v/${token}`,
  test: (token: string) => `/quiz/v/${token}/test`,
  result: (token: string) => `/quiz/v/${token}/result`,
};

/**
 * Exam lifecycle (client side):
 *   loading → gate (pending examinee, no attempt yet) → starting → running → submitting → done
 *                                                                 ↘ missing (nothing to resume)
 */
export type Phase = 'loading' | 'gate' | 'starting' | 'running' | 'submitting' | 'done' | 'missing';

interface Options {
  /** Called inside the Start-Quiz click so fullscreen can be requested within the user gesture. */
  beforeStart?: () => Promise<void>;
}

export function useAttemptRuntime(token: string, quizId: string, { beforeStart }: Options = {}) {
  const navigate = useNavigate();
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  /** Required question ids the server refused a manual submit for. */
  const [missing, setMissing] = useState<string[]>([]);
  const submittingRef = useRef(false);

  const submit = useCallback(
    async (reason: SubmissionReason) => {
      const { attempt, answers, receipt } = useAttemptStore.getState();
      if (!attempt || receipt || submittingRef.current) return;
      submittingRef.current = true;
      setPhase('submitting');
      if (reason !== 'manual') stopTimer();
      try {
        const { receipt: r } = await examineeApi.submit(token, attempt.id, answers, reason);
        stopTimer();
        useAttemptStore.getState().setReceipt(r);
        setPhase('done');
        // Browser controls unlock immediately upon submission.
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
        navigate(examineePaths.result(token), { replace: true });
      } catch (err) {
        submittingRef.current = false;
        setPhase('running');
        const details = err instanceof HttpError ? (err.details as { missing?: string[] } | undefined) : undefined;
        if (details?.missing) {
          setMissing(details.missing);
          setError('Please answer every required question before submitting.');
        } else setError('Submission failed. Check your connection and try again — your answers are saved on this device.');
      }
    },
    [token, navigate, stopTimer],
  );

  const runTimer = useCallback(
    (expiresAt: string, startedAt: string) => {
      startTimer({ expiresAt, startedAt, clockOffsetMs: useAttemptStore.getState().clockOffsetMs, onExpire: () => void submit('timeout') });
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
      const started = await examineeApi.start(token, pending);
      store.begin(token, started.attempt, started.questions, started.serverTime);
      store.clearPendingExaminee(token);
      runTimer(started.attempt.expiresAt, started.attempt.startedAt);
      setPhase('running');
    } catch (err) {
      if (err instanceof HttpError && err.status === 400) {
        store.clearPendingExaminee(token);
        navigate(examineePaths.entry(token), { replace: true });
        return;
      }
      setPhase('gate');
      setError(err instanceof HttpError && err.status === 404 ? 'This quiz is no longer accepting responses.' : 'Could not start the exam. Please try again.');
    }
  }, [token, quizId, beforeStart, runTimer, navigate]);

  useEffect(() => {
    let cancelled = false;
    const store = useAttemptStore.getState();
    const persisted = store.hydrate(token);
    if (persisted?.quizId !== quizId) {
      setPhase(store.getPendingExaminee(token, quizId) ? 'gate' : 'missing');
      return;
    }
    if (persisted.receipt) {
      navigate(examineePaths.result(token), { replace: true });
      return;
    }
    // Always re-sync against the server: it owns the deadline, so a refresh can't reset the clock.
    void examineeApi
      .resume(token, persisted.attemptId)
      .then((res) => {
        if (cancelled) return;
        store.restore(token, res.attempt, res.questions, res.serverTime, persisted);
        if (res.attempt.status === 'submitted') {
          void examineeApi.result(token, res.attempt.id).then(({ receipt }) => {
            store.setReceipt(receipt);
            navigate(examineePaths.result(token), { replace: true });
          });
          return;
        }
        runTimer(res.attempt.expiresAt, res.attempt.startedAt);
        setPhase('running');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof HttpError && err.status === 404) store.clear(token);
        setPhase('missing');
      });
    return () => {
      cancelled = true;
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, quizId]);

  return { phase, error, missing, start, submit, clearError: () => setError(null) };
}
