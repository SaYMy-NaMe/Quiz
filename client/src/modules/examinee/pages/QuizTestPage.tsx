import { useCallback, useState } from 'react';
import { Link, useLoaderData } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';
import { WizardSteps } from '../components/WizardSteps';
import { McqRenderer } from '@/modules/quiz/components/McqRenderer';
import { Timer } from '@/modules/quiz/components/Timer';
import { useAttemptStore } from '@/modules/quiz/store/attempt.store';
import { useAttemptRuntime, examineePaths } from '../hooks/useAttemptRuntime';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { useProctor, ProctorOverlays } from '@/modules/proctor';

export function Component() {
  const { quiz, token, invite } = useLoaderData() as ShareLoaderData;
  const { phase, error, submit, clearError } = useAttemptRuntime(token, invite, quiz.id);
  const questions = useAttemptStore((s) => s.questions);
  const answers = useAttemptStore((s) => s.answers);
  const answer = useAttemptStore((s) => s.answer);
  const [confirm, setConfirm] = useState(false);
  const onThreshold = useCallback(() => void submit('violation'), [submit]);
  const proctor = useProctor({ token, invite, active: phase === 'ready', onThresholdReached: onThreshold });

  if (phase === 'loading') return <Spinner label="Restoring your attempt…" fullscreen />;
  if (phase === 'missing') {
    return (
      <main className="page page--center">
        <div className="card card--narrow">
          <h2>No attempt in progress</h2>
          <p className="muted">Start from the details form to begin the test.</p>
          <Link className="btn btn--primary" to={examineePaths.entry(token, invite)}>Go to start</Link>
        </div>
      </main>
    );
  }

  const answered = questions.filter((q) => answers[q.id]).length;
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const submitting = phase === 'submitting' || phase === 'done';

  return (
    <>
      <div className="sticky-bar">
        <div>
          <strong>{quiz.title}</strong>
          <div className="small muted">{answered}/{questions.length} answered</div>
        </div>
        <div className="row">
          <Timer />
          <button className="btn btn--primary" onClick={() => setConfirm(true)} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
      <main className="page" style={{ maxWidth: 820 }}>
        <WizardSteps current={2} />
        <div className="progress" aria-hidden="true" style={{ marginBottom: '1rem' }}>
          <div className="progress__bar" style={{ width: `${progress}%` }} />
        </div>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}{' '}
            <button className="btn btn--sm" onClick={() => { clearError(); void submit('manual'); }}>Retry</button>
          </div>
        )}
        <div className="stack">
          {questions.map((q, i) => (
            <McqRenderer key={q.id} question={q} index={i} selected={answers[q.id]} onSelect={(oid) => answer(q.id, oid)} />
          ))}
        </div>
        <div className="row row--end" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn--primary btn--lg" onClick={() => setConfirm(true)} disabled={submitting}>Submit answers</button>
        </div>
      </main>
      <ProctorOverlays
        warning={proctor.warning}
        onDismiss={proctor.dismissWarning}
        fullscreen={proctor.fullscreen}
        onEnterFullscreen={() => void proctor.enterFullscreen()}
        softNotice={proctor.softNotice}
        submitting={submitting}
      />
      {confirm && (
        <Modal title="Submit your answers?" onClose={() => setConfirm(false)}>
          <p>
            You have answered <strong>{answered}</strong> of <strong>{questions.length}</strong> questions.
            {answered < questions.length && ' Unanswered questions score zero.'} This cannot be undone.
          </p>
          <div className="row row--end">
            <button className="btn" onClick={() => setConfirm(false)}>Keep working</button>
            <button className="btn btn--primary" onClick={() => { setConfirm(false); void submit('manual'); }}>Submit now</button>
          </div>
        </Modal>
      )}
    </>
  );
}
