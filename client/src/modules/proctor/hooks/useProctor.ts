import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VIOLATION_THRESHOLD } from '@shared';
import { createProctor, type ViolationEvent, type ViolationKind } from '../services/proctor';
import { examineeApi } from '@/modules/examinee/services/attempt.api';
import { useAttemptStore } from '@/store/attempt.store';

export interface ProctorWarning {
  kind: ViolationKind;
  count: number;
  threshold: number;
}

interface Options {
  token: string;
  /** Only arm while the test is actually running. */
  active: boolean;
  onThresholdReached: () => void;
}

/**
 * Violation submission pipeline: hard violations are recorded locally
 * (persisted with the attempt), reported to the server, and once the
 * threshold is hit the runtime auto-submits with reason=violation.
 */
export function useProctor({ token, active, onThresholdReached }: Options) {
  const proctor = useMemo(() => createProctor(), []);
  const [warning, setWarning] = useState<ProctorWarning | null>(null);
  const [fullscreen, setFullscreen] = useState(() => proctor.isFullscreen());
  const [softNotice, setSoftNotice] = useState<string | null>(null);
  const thresholdFired = useRef(false);

  const handle = useCallback(
    (event: ViolationEvent) => {
      if (event.soft) {
        setSoftNotice(event.kind === 'contextmenu' ? 'Right-click is disabled during the test.' : 'That shortcut is disabled during the test.');
        return;
      }
      if (event.kind === 'fullscreen-exit') setFullscreen(false);
      const state = useAttemptStore.getState();
      if (!state.attempt || state.receipt) return;
      const count = state.recordViolation();
      setWarning({ kind: event.kind, count, threshold: VIOLATION_THRESHOLD });
      void examineeApi
        .reportViolation(token, state.attempt.id, event.kind)
        .then((r) => {
          if (r.violations > count) useAttemptStore.getState().syncViolations(r.violations);
          if (r.shouldSubmit && !thresholdFired.current) {
            thresholdFired.current = true;
            onThresholdReached();
          }
        })
        .catch(() => undefined);
      if (count >= VIOLATION_THRESHOLD && !thresholdFired.current) {
        thresholdFired.current = true;
        onThresholdReached();
      }
    },
    [token, onThresholdReached],
  );

  useEffect(() => {
    if (!active) return;
    const unsubscribe = proctor.subscribe(handle);
    proctor.arm();
    setFullscreen(proctor.isFullscreen());
    return () => {
      unsubscribe();
      proctor.disarm();
    };
  }, [active, proctor, handle]);

  useEffect(() => {
    if (!softNotice) return;
    const t = window.setTimeout(() => setSoftNotice(null), 2500);
    return () => window.clearTimeout(t);
  }, [softNotice]);

  const enterFullscreen = useCallback(async () => {
    const ok = await proctor.requestFullscreen();
    setFullscreen(ok || proctor.isFullscreen());
  }, [proctor]);

  return {
    warning,
    dismissWarning: () => setWarning(null),
    fullscreen,
    enterFullscreen,
    exitFullscreen: () => proctor.exitFullscreen(),
    softNotice,
  };
}
