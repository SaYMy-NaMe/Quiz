import { useEffect, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';
import { WizardSteps } from '../components/WizardSteps';
import { ExamineeDetailsForm } from '../components/ExamineeDetailsForm';
import { attemptApi } from '../services/attempt.api';
import { useAttemptStore } from '@/store/attempt.store';
import { HttpError } from '@/services/http';
import type { ExamineeRecord } from '@/types';
import { createProctor } from '@/modules/proctor';

const testPath = (token: string, invite: string | null) => `/quiz/v/${token}/test${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;
const resultPath = (token: string, invite: string | null) => `/quiz/v/${token}/result${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

export function Component() {
  const { quiz, token, invite } = useLoaderData() as ShareLoaderData;
  const navigate = useNavigate();
  const begin = useAttemptStore((s) => s.begin);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);

  // Resume an in-flight attempt (or show the receipt) after refresh / navigation.
  useEffect(() => {
    const persisted = useAttemptStore.getState().hydrate(token);
    if (persisted?.quizId !== quiz.id) return;
    navigate(persisted.receipt ? resultPath(token, invite) : testPath(token, invite), { replace: true });
  }, [navigate, quiz.id, token, invite]);

  const start = async (examinee: ExamineeRecord) => {
    setBusy(true);
    setServerError(null);
    setFieldErrors(null);
    // Fullscreen must be requested inside the user gesture; it persists across SPA navigation.
    await createProctor().requestFullscreen();
    try {
      const started = await attemptApi.start(token, examinee, invite);
      begin(token, started.attempt, started.questions, started.serverTime);
      navigate(testPath(token, invite), { replace: true });
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
    <main className="page" style={{ maxWidth: 720 }}>
      <WizardSteps current={1} />
      <h1>{quiz.title}</h1>
      {quiz.description && <p className="muted">{quiz.description}</p>}
      <ExamineeDetailsForm quiz={quiz} busy={busy} serverError={serverError} serverFieldErrors={fieldErrors} onSubmit={(d) => void start(d)} />
    </main>
  );
}
