import { useCallback, useEffect, useRef, useState } from 'react';
import type { Leaderboard } from '@shared';
import { HttpError } from '@/utils/api';

interface Options {
  /** Poll interval in ms; 0 disables polling. */
  pollMs?: number;
}

/** Fetches a leaderboard and keeps it fresh by polling while the tab is visible. */
export function useLeaderboard(fetcher: (signal: AbortSignal) => Promise<{ leaderboard: Leaderboard }>, { pollMs = 0 }: Options = {}) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const { leaderboard } = await fetcherRef.current(signal);
      setBoard(leaderboard);
      setError(null);
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof HttpError ? { status: err.status, message: err.message } : { status: 0, message: 'Network error' });
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    if (!pollMs) return () => controller.abort();
    const tick = () => {
      if (document.visibilityState === 'visible') void load(controller.signal);
    };
    const id = window.setInterval(tick, pollMs);
    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [load, pollMs]);

  const refresh = useCallback(() => load(new AbortController().signal), [load]);
  return { board, error, loading, refresh };
}
