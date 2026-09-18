import { useEffect, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';
import { WizardSteps } from '../components/WizardSteps';
import { ExamineeDetailsForm } from '../components/ExamineeDetailsForm';
import { attemptApi } from '../services/attempt.api';
import { useAttemptStore } from '@/store/attempt.store';
import { HttpError } from '@/services/http';
import type { ExamineeRecord } from '@/types';
import { examineePaths } from '../hooks/useAttemptRuntime';

/** Step 1: collect + validate examinee metadata. Nothing timed happens here. */
export function Component() {
  const { quiz, token, invite } = useLoaderData() as ShareLoaderData;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [initial] = useState(() => useAttemptStore.getState().getPendingExaminee(token, quiz.id));

  // An in-flight or finished attempt skips Step 1 entirely (refresh / back navigation).
  useEffect(() => {
    const persisted = useAttemptStore.getState().hydrate(token);
    if (persisted?.quizId !== quiz.id) return;
    navigate(persisted.receipt ? examineePaths.result(token, invite) : examineePaths.test(token, invite), { replace: true });
  }, [navigate, quiz.id, token, invite]);

  const submit = async (examinee: ExamineeRecord) => {
    setBusy(true);
    setServerError(null);
    setFieldErrors(null);
    try {
      const { examinee: clean } = await attemptApi.validate(token, examinee, invite);
      useAttemptStore.getState().setPendingExaminee(token, quiz.id, clean);
      navigate(examineePaths.test(token, invite));
    } catch (err) {
      if (err instanceof HttpError) {
        const details = err.details as { fieldErrors?: Record<string, string> } | undefined;
        if (details?.fieldErrors) setFieldErrors(details.fieldErrors);
        setServerError(err.status === 404 ? 'This quiz is no longer accepting responses.' : err.message);
      } else setServerError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gf-page">
      <main className="page" style={{ maxWidth: 720 }}>
        <WizardSteps current={1} />
        <section className="gf-card gf-card--title">
          <h1 className="gf-card__title">{quiz.title}</h1>
          {quiz.description && <p className="gf-card__desc">{quiz.description}</p>}
          <p className="small muted" style={{ marginBottom: 0 }}>
            {quiz.questionCount} questions · {Math.round(quiz.durationSeconds / 60)} minute time limit · proctored
          </p>
        </section>
        <ExamineeDetailsForm quiz={quiz} initialValues={initial} busy={busy} serverError={serverError} serverFieldErrors={fieldErrors} onSubmit={(d) => void submit(d)} />
      </main>
    </div>
  );
}
