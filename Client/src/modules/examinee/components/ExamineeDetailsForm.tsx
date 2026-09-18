import { useState, type FormEvent } from 'react';
import type { PublicQuiz, ExamineeRecord } from '@/types';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import { useDynamicValidation, type FormValues } from '../hooks/useDynamicValidation';

interface Props {
  quiz: PublicQuiz;
  initialValues?: ExamineeRecord | null;
  busy: boolean;
  serverError: string | null;
  serverFieldErrors: Record<string, string> | null;
  onSubmit: (examinee: ExamineeRecord) => void;
}

/**
 * Wizard Step 1 — instructor-defined metadata form. Pure data collection:
 * no timer, no proctoring, nothing is created on the server until "Start Quiz".
 */
export function ExamineeDetailsForm({ quiz, initialValues, busy, serverError, serverFieldErrors, onSubmit }: Props) {
  const emailField = quiz.examineeFields.find((f) => f.type === 'email');
  const locked = quiz.lockedEmail && emailField ? [emailField.fieldId] : [];
  const [values, setValues] = useState<FormValues>(() => {
    const seed: FormValues = {};
    for (const [k, v] of Object.entries(initialValues ?? {})) seed[k] = String(v);
    if (quiz.lockedEmail && emailField) seed[emailField.fieldId] = quiz.lockedEmail;
    return seed;
  });
  const { errors, validateAll, validateField, setServerErrors } = useDynamicValidation(quiz.examineeFields);
  const displayedErrors = serverFieldErrors ?? errors;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateAll(values);
    if (!result.ok) return;
    onSubmit(result.data);
  };

  return (
    <form onSubmit={submit} noValidate>
      <section className="gf-card">
        <h2 style={{ fontWeight: 500 }}>Your details</h2>
        {serverError && (
          <div className="alert alert--error" role="alert">
            {serverError}
          </div>
        )}
        {quiz.examineeFields.length === 0 && <p className="muted">No details required — continue to the exam.</p>}
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
        <p className="small muted" style={{ marginBottom: 0 }}>
          <span className="gf-required-dot">*</span> Required
        </p>
      </section>
      <div className="row row--between">
        <span className="small muted">Next: you'll see the rules and a "Start Quiz" button. The timer only starts then.</span>
        <button className="btn btn--primary btn--lg" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </form>
  );
}
