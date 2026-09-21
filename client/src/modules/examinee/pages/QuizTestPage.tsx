import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShareData } from '@/router/useShareData';
import { WizardSteps } from '../components/WizardSteps';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { Timer } from '../components/Timer';
import { StartGate } from '../components/StartGate';
import { useAttemptStore } from '@/store/attempt.store';
import { useAttemptRuntime, examineePaths } from '../hooks/useAttemptRuntime';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { useProctor, ProctorOverlays, createProctor } from '@/modules/proctor';

export function Component() {
  const { quiz, token } = useShareData();
  const navigate = useNavigate();
  // Fullscreen must be requested inside the Start-Quiz gesture; it persists across the attempt.
  const beforeStart = useCallback(async () => {
    await createProctor().requestFullscreen();
  }, []);
  const { phase, error, missing, start, submit, clearError } = useAttemptRuntime(token, quiz.id, { beforeStart });
  const questions = useAttemptStore((s) => s.questions);
  const answers = useAttemptStore((s) => s.answers);
  const answer = useAttemptStore((s) => s.answer);
  const [confirm, setConfirm] = useState(false);
  const onThreshold = useCallback(() => void submit('violation'), [submit]);
  const proctor = useProctor({ token, active: phase === 'running', onThresholdReached: onThreshold });

  if (phase === 'loading') return <Spinner label="Restoring your attempt…" fullscreen />;

  if (phase === 'missing') {
    return (
      <main className="page page--center">
        <div className="card card--narrow">
          <h2>Start from your details</h2>
          <p className="muted">We need your details before the exam can begin.</p>
          <Link className="btn btn--primary" to={examineePaths.entry(token)}>Go to Step 1</Link>
        </div>
      </main>
    );
  }

  if (phase === 'gate' || phase === 'starting') {
    return (
      <div className="gf-page">
        <main className="page" style={{ maxWidth: 720 }}>
          <WizardSteps current={2} />
          <StartGate quiz={quiz} starting={phase === 'starting'} error={error} onStart={() => void start()} onBack={() => navigate(examineePaths.entry(token))} />
        </main>
      </div>
    );
  }

  const answered = questions.filter((q) => (answers[q.id] ?? '').trim()).length;
  const unansweredRequired = questions.filter((q) => q.required && !(answers[q.id] ?? '').trim());
  const submitting = phase === 'submitting' || phase === 'done';

  return (
    <div className="gf-page">
      <div className="sticky-bar">
        <div>
          <strong>{quiz.title}</strong>
          <div className="small muted">{answered}/{questions.length} answered</div>
        </div>
        <button className="btn btn--primary" onClick={() => setConfirm(true)} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
      <Timer floating />
      <main className="page" style={{ maxWidth: 820 }}>
        <WizardSteps current={2} />
        {error && (
          <div className="alert alert--error" role="alert">
            {error}{' '}
            <button className="btn btn--sm" onClick={() => { clearError(); void submit('manual'); }}>Retry</button>
          </div>
        )}
        <div className="stack">
          {questions.map((q, i) => (
            <div key={q.id} style={missing.includes(q.id) ? { outline: '2px solid var(--danger)', borderRadius: 'var(--radius)' } : undefined}>
              <QuestionRenderer question={q} index={i} value={answers[q.id]} onChange={(v) => answer(q.id, v)} />
            </div>
          ))}
        </div>
        <div className="row row--end" style={{ marginTop: '1.5rem', paddingBottom: '5rem' }}>
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
            {unansweredRequired.length > 0 ? ` ${unansweredRequired.length} required question${unansweredRequired.length === 1 ? ' is' : 's are'} still unanswered — the submission will be refused.` : answered < questions.length ? ' Unanswered questions score zero.' : ''} This cannot be undone.
          </p>
          <div className="row row--end">
            <button className="btn" onClick={() => setConfirm(false)}>Keep working</button>
            <button className="btn btn--primary" onClick={() => { setConfirm(false); void submit('manual'); }}>Submit now</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
