import { useState, type FormEvent } from 'react';
import type { PublicQuiz, ExamineeRecord } from '@/types';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import { useDynamicValidation, type FormValues } from '../hooks/useDynamicValidation';

interface Props {
  quiz: PublicQuiz;
  busy: boolean;
  serverError: string | null;
  serverFieldErrors: Record<string, string> | null;
  onSubmit: (examinee: ExamineeRecord) => void;
}

/** Wizard Step 1: instructor-defined metadata form, validated by the dynamic engine. */
export function ExamineeDetailsForm({ quiz, busy, serverError, serverFieldErrors, onSubmit }: Props) {
  const emailField = quiz.examineeFields.find((f) => f.type === 'email');
  const locked = quiz.lockedEmail && emailField ? [emailField.fieldId] : [];
  const [values, setValues] = useState<FormValues>(() =>
    quiz.lockedEmail && emailField ? { [emailField.fieldId]: quiz.lockedEmail } : {},
  );
  const { errors, validateAll, validateField, setServerErrors } = useDynamicValidation(quiz.examineeFields);
  const displayedErrors = serverFieldErrors ?? errors;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateAll(values);
    if (!result.ok) return;
    onSubmit(result.data);
  };

  return (
    <form onSubmit={submit} noValidate className="card">
      <h2>Before you start</h2>
      <p className="muted">
        The test has <strong>{quiz.questionCount}</strong> questions and a strict limit of{' '}
        <strong>{Math.round(quiz.durationSeconds / 60)} minutes</strong>. The timer starts as soon as you continue and cannot be paused.
      </p>
      {serverError && (
        <div className="alert alert--error" role="alert">
          {serverError}
        </div>
      )}
      {quiz.examineeFields.length === 0 && <p className="muted">No details required — you can start right away.</p>}
      <DynamicFormRenderer
        fields={quiz.examineeFields}
        values={values}
        errors={displayedErrors}
        lockedFieldIds={locked}
        onChange={(id, v) => {
          setValues((s) => ({ ...s, [id]: v }));
          if (serverFieldErrors) setServerErrors({});
        }}
        onBlur={(id) => validateField(id, values)}
      />
      <div className="alert alert--warning">
        <strong>Proctoring notice:</strong> the test runs in fullscreen. Leaving the tab or window is recorded; after two
        warnings your answers are submitted automatically.
      </div>
      <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
        {busy ? 'Starting…' : 'Start timed test'}
      </button>
    </form>
  );
}
