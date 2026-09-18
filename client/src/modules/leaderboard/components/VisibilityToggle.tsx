import { useState } from 'react';
import { quizApi } from '@/modules/builder/services/quiz.api';
import type { Quiz } from '@/types';

interface Props {
  quiz: Quiz;
  onChange: (quiz: Quiz) => void;
}

/** Instructor access-matrix control: show/hide the leaderboard for examinees. */
export function VisibilityToggle({ quiz, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={quiz.leaderboardVisible}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          try {
            const { quiz: updated } = await quizApi.setLeaderboardVisibility(quiz.id, e.target.checked);
            onChange(updated);
          } finally {
            setBusy(false);
          }
        }}
      />
      <span>
        Leaderboard visible to examinees
        <br />
        <span className="muted small">{quiz.leaderboardVisible ? 'Examinees can open the board from their result page.' : 'Only you can see the board.'}</span>
      </span>
    </label>
  );
}
