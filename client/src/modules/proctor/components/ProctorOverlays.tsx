import { Modal } from '@/components/Modal';
import type { ProctorWarning } from '../hooks/useProctor';
import type { ViolationKind } from '../services/proctor';

const KIND_LABEL: Record<ViolationKind, string> = {
  visibility: 'You switched tabs or minimised the window',
  blur: 'The test window lost focus',
  'fullscreen-exit': 'You left fullscreen mode',
  shortcut: 'A blocked shortcut was used',
  contextmenu: 'The context menu was opened',
};

interface Props {
  warning: ProctorWarning | null;
  onDismiss: () => void;
  fullscreen: boolean;
  onEnterFullscreen: () => void;
  softNotice: string | null;
  submitting: boolean;
}

export function ProctorOverlays({ warning, onDismiss, fullscreen, onEnterFullscreen, softNotice, submitting }: Props) {
  const exceeded = warning ? warning.count >= warning.threshold : false;
  return (
    <>
      {softNotice && (
        <div className="alert alert--warning" role="status" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 90, maxWidth: 480, margin: '0 auto' }}>
          {softNotice}
        </div>
      )}
      {warning && (
        <Modal title={exceeded ? 'Test auto-submitted' : `Warning ${warning.count} of ${warning.threshold}`} onClose={exceeded ? () => undefined : onDismiss}>
          <p>
            <strong>{KIND_LABEL[warning.kind]}.</strong>
          </p>
          {exceeded ? (
            <p>You reached the violation limit. Your answers {submitting ? 'are being' : 'have been'} submitted automatically.</p>
          ) : (
            <p>
              Leaving the test again will submit your answers automatically. Stay in this fullscreen window until you finish.
            </p>
          )}
          {!exceeded && (
            <div className="row row--end">
              <button
                className="btn btn--primary"
                onClick={() => {
                  onDismiss();
                  if (!fullscreen) onEnterFullscreen();
                }}
              >
                Return to test
              </button>
            </div>
          )}
        </Modal>
      )}
      {!warning && !fullscreen && !submitting && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fs-title">
            <h2 id="fs-title">Fullscreen required</h2>
            <p>This test must be taken in fullscreen. The timer keeps running while this notice is shown.</p>
            <div className="row row--end">
              <button className="btn btn--primary btn--lg" onClick={onEnterFullscreen} autoFocus>
                Enter fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
