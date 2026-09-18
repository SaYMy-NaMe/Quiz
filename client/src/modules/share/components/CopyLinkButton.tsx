import { useEffect, useState } from 'react';
import { copyToClipboard } from '../services/link-builder';

export function CopyLinkButton({ text, label = 'Copy link', size = '' }: { text: string; label?: string; size?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className={`btn ${size}`}
      onClick={() => void copyToClipboard(text).then((ok) => setCopied(ok))}
      aria-live="polite"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
