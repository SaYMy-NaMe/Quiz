import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from '@shared';
import { useEditorStore } from '../store/editor.store';

export function QuizSettingsForm({ errors = {} }: { errors?: Record<string, string> }) {
  const settings = useEditorStore((s) => s.draft.settings);
  const setSettings = useEditorStore((s) => s.setSettings);
  const minutes = Math.round(settings.durationSeconds / 60);

  return (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="duration">Time limit (minutes)</label>
        <input
          id="duration"
          type="number"
          className="input"
          min={Math.ceil(MIN_DURATION_SECONDS / 60)}
          max={Math.floor(MAX_DURATION_SECONDS / 60)}
          value={minutes}
          onChange={(e) => setSettings({ durationSeconds: Math.max(1, Number(e.target.value) || 1) * 60 })}
          aria-invalid={errors['durationSeconds'] ? 'true' : undefined}
        />
        <span className="field__hint">The countdown starts the moment an examinee enters the test and auto-submits at 00:00.</span>
        {errors['durationSeconds'] && <span className="field__error">{errors['durationSeconds']}</span>}
      </div>

      <label className="switch">
        <input type="checkbox" checked={settings.revealAnswers} onChange={(e) => setSettings({ revealAnswers: e.target.checked })} />
        <span>
          <strong>Reveal answer key after submission</strong>
          <br />
          <span className="muted small">Examinees see which options were correct on their result page.</span>
        </span>
      </label>

      <label className="switch">
        <input type="checkbox" checked={settings.leaderboardVisible} onChange={(e) => setSettings({ leaderboardVisible: e.target.checked })} />
        <span>
          <strong>Leaderboard visible to examinees</strong>
          <br />
          <span className="muted small">You can toggle this at any time from the dashboard.</span>
        </span>
      </label>

      <div className="field">
        <span className="field__label">Access mode</span>
        <div className="row" role="radiogroup" aria-label="Access mode">
          <label className="checkbox">
            <input type="radio" name="access" checked={settings.accessMode === 'public'} onChange={() => setSettings({ accessMode: 'public' })} />
            Anyone with the link
          </label>
          <label className="checkbox">
            <input type="radio" name="access" checked={settings.accessMode === 'restricted'} onChange={() => setSettings({ accessMode: 'restricted' })} />
            Restricted (invited emails only)
          </label>
        </div>
        <span className="field__hint">Quizzes are never listed publicly; they are reachable only through their share link.</span>
      </div>
    </div>
  );
}
