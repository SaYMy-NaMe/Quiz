import { useTimerStore } from '@/store/timer.store';
import { formatClock } from '@/utils/countdown';

interface Props {
  /** Fixed-position widget that stays visible while scrolling through questions. */
  floating?: boolean;
}

export function Timer({ floating = false }: Props) {
  const remaining = useTimerStore((s) => s.remaining);
  const total = useTimerStore((s) => s.total);
  const ratio = total > 0 ? remaining / total : 1;
  const tone = remaining <= 30 ? 'timer--danger' : ratio <= 0.2 ? 'timer--warning' : '';
  return (
    <div className={`timer ${tone} ${floating ? 'timer--floating' : ''}`} role="timer" aria-live={remaining <= 30 ? 'assertive' : 'off'} aria-label="Time remaining">
      <span aria-hidden="true">⏱</span> {formatClock(remaining)}
      {floating && (
        <div className="progress timer__progress" aria-hidden="true">
          <div className="progress__bar" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
