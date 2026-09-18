import { useRef, useState } from 'react';
import { MAX_IMAGE_BYTES } from '@shared';
import { quizApi } from '../services/quiz.api';
import { HttpError } from '@/services/http';

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 2 MB or smaller');
      return;
    }
    setBusy(true);
    try {
      const { url } = await quizApi.uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="field">
      <span className="field__label">Image prompt</span>
      {value && <img src={value} alt="Question prompt" className="question__image" loading="lazy" decoding="async" />}
      <div className="row">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => void onFile(e.target.files?.[0])}
          disabled={busy}
          aria-label="Upload question image"
        />
        {value && (
          <button type="button" className="btn btn--sm" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
        {busy && <span className="muted small">Uploading…</span>}
      </div>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
