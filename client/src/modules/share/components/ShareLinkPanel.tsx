import { useState } from 'react';
import type { Quiz } from '@/types';
import { buildShareUrl } from '../services/link-builder';
import { CopyLinkButton } from './CopyLinkButton';
import { HttpError } from '@/utils/api';
import { quizApi } from '@/modules/builder/services/quiz.api';
import { Modal } from '@/components/Modal';

interface Props {
  quiz: Quiz;
  onQuizChange?: (quiz: Quiz) => void;
}

/** One-click share link generator with a confirm-guarded "regenerate" that invalidates old links. */
export function ShareLinkPanel({ quiz, onQuizChange }: Props) {
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quiz.shareToken) return <div className="alert alert--info">Publish the quiz to generate its private share link.</div>;
  const link = buildShareUrl(quiz.shareToken);

  return (
    <div className="stack">
      <div className="row row--between">
        <h3>Share link</h3>
        <span className={`badge badge--${quiz.status}`}>{quiz.status}</span>
      </div>
      {quiz.status !== 'published' && <div className="alert alert--warning">The quiz is {quiz.status}; the link will return 404 until it is published.</div>}
      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="link-box">
        <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
        <CopyLinkButton text={link} />
        {onQuizChange && (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmRotate(true)} disabled={rotating} title="Generate a new link and invalidate the old one">↻ Regenerate</button>
        )}
      </div>
      <p className="small muted">Anyone holding this link can take the quiz without an account. It is never listed anywhere.</p>
      {confirmRotate && (
        <Modal title="Regenerate share link?" onClose={() => setConfirmRotate(false)}>
          <p>The current link will stop working immediately. Existing submissions are kept.</p>
          <div className="row row--end">
            <button className="btn" onClick={() => setConfirmRotate(false)}>Cancel</button>
            <button
              className="btn btn--danger"
              disabled={rotating}
              onClick={async () => {
                setRotating(true);
                try {
                  const { quiz: updated } = await quizApi.rotateToken(quiz.id);
                  onQuizChange?.(updated);
                  setConfirmRotate(false);
                } catch (err) {
                  setError(err instanceof HttpError ? err.message : 'Could not regenerate the link');
                } finally {
                  setRotating(false);
                }
              }}
            >
              {rotating ? 'Regenerating…' : 'Regenerate link'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
