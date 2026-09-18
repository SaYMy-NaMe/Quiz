import { useRef, useState } from 'react';
import { MAX_IMAGE_BYTES } from '@shared';
import { quizApi } from '../services/quiz.api';
import { HttpError } from '@/services/http';
import { assetUrl } from '@/config';

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  /** Compact mode for choice thumbnails. */
  compact?: boolean;
}

export function ImageUploader({ value, onChange, label = 'Image', compact = false }: ImageUploaderProps) {
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
    <div className={compact ? 'row' : 'field'} style={compact ? { gap: '0.5rem' } : undefined}>
      {!compact && <span className="field__label">{label}</span>}
      {value && (
        <img src={assetUrl(value)} alt={label} className={compact ? '' : 'question__image'} style={compact ? { width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' } : undefined} loading="lazy" decoding="async" />
      )}
      <div className="row" style={{ gap: '0.5rem' }}>
        <label className="btn btn--sm" style={{ cursor: busy ? 'progress' : 'pointer' }}>
          {busy ? 'Uploading…' : value ? '🖼 Replace' : '🖼 Add image'}
          <input ref={inputRef} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void onFile(e.target.files?.[0])} disabled={busy} aria-label={`Upload ${label.toLowerCase()}`} />
        </label>
        {value && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
