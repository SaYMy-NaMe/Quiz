import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { quizApi } from '@/modules/quiz/services/quiz.api';
import { HttpError } from '@/services/http';

interface Props {
  quizId: string;
  title: string;
  submissionCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteQuizModal({ quizId, title, submissionCount, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Delete quiz?" onClose={onClose}>
      <p>
        <strong>{title}</strong> and its <strong>{submissionCount}</strong> submission{submissionCount === 1 ? '' : 's'} will be permanently deleted. Its share link will stop working immediately.
      </p>
      {error && <div className="alert alert--error" role="alert">{error}</div>}
      <div className="row row--end">
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button
          className="btn btn--danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await quizApi.remove(quizId);
              onDeleted();
            } catch (err) {
              setError(err instanceof HttpError ? err.message : 'Could not delete');
              setBusy(false);
            }
          }}
        >
          {busy ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </Modal>
  );
}
