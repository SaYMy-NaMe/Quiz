import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from '@shared';
import { useEditorStore } from '@/store/editor.store';

export function QuizSettingsForm({ errors = {} }: { errors?: Record<string, string> }) {
  const settings = useEditorStore((s) => s.draft.settings);
  const setSettings = useEditorStore((s) => s.setSettings);
  const minutes = Math.round(settings.durationSeconds / 60);

  const toggle = (key: keyof typeof settings, label: string, hint: string, extra?: (checked: boolean) => Partial<typeof settings>) => (
    <label className="switch" key={key}>
      <input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => setSettings({ [key]: e.target.checked, ...(extra?.(e.target.checked) ?? {}) })} />
      <span>
        <strong>{label}</strong>
        <br />
        <span className="muted small">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="duration">Time limit (minutes)</label>
        <input id="duration" type="number" className="input" min={Math.ceil(MIN_DURATION_SECONDS / 60)} max={Math.floor(MAX_DURATION_SECONDS / 60)} value={minutes} onChange={(e) => setSettings({ durationSeconds: Math.max(1, Number(e.target.value) || 1) * 60 })} aria-invalid={errors.durationSeconds ? 'true' : undefined} />
        <span className="field__hint">The countdown starts when the examinee clicks "Start Quiz" and auto-submits at 00:00.</span>
        {errors.durationSeconds && <span className="field__error">{errors.durationSeconds}</span>}
      </div>
      <h3>Randomisation</h3>
      {toggle('shuffleQuestions', 'Shuffle question order', 'Each attempt gets its own question order.')}
      {toggle('shuffleOptions', 'Shuffle answer choices', 'Each attempt gets its own option order per MCQ.')}
      <h3>After submission</h3>
      {toggle('revealScores', 'Reveal score', 'Examinees see their score on the result page. Off = a plain "submitted" confirmation.', (on) => (on ? {} : { revealAnswers: false }))}
      {toggle('revealAnswers', 'Reveal answer key', 'Examinees see the correct answers (implies the score is shown). Keys are never sent before submission.', (on) => (on ? { revealScores: true } : {}))}
      <p className="field__hint">Quizzes are never listed publicly; they are reachable only through their share link.</p>
    </div>
  );
}
