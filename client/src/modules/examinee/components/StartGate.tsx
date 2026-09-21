import type { PublicQuiz } from '@/types';
import { VIOLATION_THRESHOLD } from '@shared';

interface Props {
  quiz: PublicQuiz;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onBack: () => void;
}

/** Step 2 gate: the exam (timer + proctoring) begins only when "Start Quiz" is clicked. */
export function StartGate({ quiz, starting, error, onStart, onBack }: Props) {
  const minutes = Math.round(quiz.durationSeconds / 60);
  return (
    <section className="gf-card gf-card--title" aria-labelledby="gate-title">
      <h1 id="gate-title" className="gf-card__title">{quiz.title}</h1>
      <p className="gf-card__desc">Read the rules, then start when you're ready. The countdown begins the moment you click.</p>
      <ul className="stack" style={{ gap: '0.4rem', paddingLeft: '1.2rem', margin: '1rem 0' }}>
        <li><strong>{quiz.questionCount}</strong> multiple-choice questions</li>
        <li><strong>{minutes} minute{minutes === 1 ? '' : 's'}</strong> strict time limit — answers auto-submit at 00:00</li>
        <li>The exam opens in <strong>fullscreen</strong>; leaving the tab, window or fullscreen is recorded</li>
        <li>After <strong>{VIOLATION_THRESHOLD}</strong> violations your answers are submitted automatically</li>
        <li>Progress is saved on this device — a refresh resumes with the same clock</li>
      </ul>
      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="row row--between">
        <button type="button" className="btn" onClick={onBack} disabled={starting}>← Edit my details</button>
        <button type="button" className="btn btn--primary btn--lg" onClick={onStart} disabled={starting} autoFocus>
          {starting ? 'Starting…' : '▶ Start Quiz'}
        </button>
      </div>
    </section>
  );
}
