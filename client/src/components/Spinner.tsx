interface SpinnerProps {
  label?: string;
  fullscreen?: boolean;
}

export function Spinner({ label = 'Loading', fullscreen = false }: SpinnerProps) {
  return (
    <div className={fullscreen ? 'spinner spinner--fullscreen' : 'spinner'} role="status" aria-live="polite">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="spinner__label">{label}</span>
    </div>
  );
}
