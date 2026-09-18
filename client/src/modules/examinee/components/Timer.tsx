import { useTimerStore } from '@/store/timer.store';
import { formatClock } from '@/utils/countdown';

export function Timer() {
  const remaining = useTimerStore((s) => s.remaining);
  const total = useTimerStore((s) => s.total);
  const ratio = total > 0 ? remaining / total : 1;
  const tone = remaining <= 30 ? 'timer--danger' : ratio <= 0.2 ? 'timer--warning' : '';
  return (
    <div className={`timer ${tone}`} role="timer" aria-live={remaining <= 30 ? 'assertive' : 'off'} aria-label="Time remaining">
      ⏱ {formatClock(remaining)}
    </div>
  );
}
