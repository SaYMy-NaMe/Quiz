import { useState } from 'react';
import { downloadSubmissionsXlsx } from '../services/export.service';
import { HttpError } from '@/services/http';

interface Props {
  quizId: string;
  disabled?: boolean;
  size?: string;
}

export function ExportButton({ quizId, disabled = false, size = '' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="row" style={{ gap: '0.4rem' }}>
      <button
        type="button"
        className={`btn ${size}`}
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadSubmissionsXlsx(quizId);
          } catch (err) {
            setError(err instanceof HttpError ? err.message : 'Export failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Preparing…' : '⬇ Export .xlsx'}
      </button>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
