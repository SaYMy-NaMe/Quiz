import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorStore } from '@/store/editor.store';
import { quizApi } from '../services/quiz.api';
import { draftToPayload } from '../services/draft.mapper';
import { validateDraft, hasErrors, type DraftErrors } from '../services/draft.validator';
import { QuestionEditor } from './QuestionEditor';
import { QuizSettingsForm } from './QuizSettingsForm';
import { HttpError } from '@/utils/api';
import { Spinner } from '@/components/Spinner';
import { Navbar } from '@/components/Navbar';
import { ExamineeSchemaBuilder } from '@/modules/builder/components/ExamineeSchemaBuilder';

type Tab = 'questions' | 'examinee' | 'settings';

const EMPTY: DraftErrors = { form: {}, questions: {}, fields: {} };

export function QuizEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useEditorStore();
  const { draft, status, dirty } = store;
  const [tab, setTab] = useState<Tab>('questions');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>(EMPTY);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useEditorStore((s) => s.load);
  const reset = useEditorStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      reset();
      setLoading(false);
      return;
    }
    void quizApi
      .get(id)
      .then(({ quiz }) => {
        if (!cancelled) load(quiz);
      })
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, load, reset, navigate]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const readOnly = status !== 'draft';
  const tabErrors = useMemo(
    () => ({
      questions: Object.keys(errors.questions).length > 0 || Boolean(errors.form.questions),
      examinee: Object.keys(errors.fields).length > 0,
      settings: Boolean(errors.form.durationSeconds),
    }),
    [errors],
  );

  const save = async () => {
    setServerError(null);
    setNotice(null);
    const next = validateDraft(draft);
    setErrors(next);
    if (hasErrors(next)) {
      if (tabErrors.questions || Object.keys(next.questions).length) setTab('questions');
      else if (Object.keys(next.fields).length) setTab('examinee');
      return;
    }
    setSaving(true);
    try {
      const payload = draftToPayload(draft);
      const { quiz } = store.quizId ? await quizApi.update(store.quizId, payload) : await quizApi.create(payload);
      store.load(quiz);
      setNotice('Saved');
      if (!id) navigate(`/dashboard/quizzes/${quiz.id}/edit`, { replace: true });
    } catch (err) {
      setServerError(err instanceof HttpError ? err.message : 'Could not save the quiz');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading quiz…" fullscreen />;

  return (
    <>
      <Navbar />
      <main className="page page--wide">
        <div className="row row--between" style={{ marginBottom: '1rem' }}>
          <div>
            <h1>{store.quizId ? 'Edit quiz' : 'New quiz'}</h1>
            <span className={`badge badge--${status}`}>{status}</span>
            {dirty && <span className="muted small" style={{ marginLeft: '0.5rem' }}>Unsaved changes</span>}
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => navigate(store.quizId ? `/dashboard/quizzes/${store.quizId}` : '/dashboard')}>
              {store.quizId ? 'Back to overview' : 'Cancel'}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={saving || readOnly}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </div>

        {readOnly && (
          <div className="alert alert--warning" role="status">
            This quiz is <strong>{status}</strong>. Unpublish it from the overview page to edit content.
          </div>
        )}
        {serverError && <div className="alert alert--error" role="alert">{serverError}</div>}
        {notice && <div className="alert alert--success" role="status">{notice}</div>}

        <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor="title">Title<span className="req" aria-hidden="true">*</span></label>
                <input id="title" className="input" value={draft.title} onChange={(e) => store.setMeta({ title: e.target.value })} aria-invalid={errors.form.title ? 'true' : undefined} />
                {errors.form.title && <span className="field__error" role="alert">{errors.form.title}</span>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="description">Description</label>
                <input id="description" className="input" value={draft.description} onChange={(e) => store.setMeta({ description: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="tabs" role="tablist">
            {(
              [
                ['questions', `Questions (${draft.questions.length})`],
                ['examinee', `Examinee fields (${draft.examineeFields.length})`],
                ['settings', 'Settings'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab ${tab === key ? 'tab--active' : ''}`} onClick={() => setTab(key)}>
                {label}
                {tabErrors[key] && <span style={{ color: 'var(--danger)' }}> •</span>}
              </button>
            ))}
          </div>

          {tab === 'questions' && (
            <div className="stack">
              {errors.form.questions && <div className="alert alert--error">{errors.form.questions}</div>}
              {draft.questions.map((q, i) => (
                <QuestionEditor key={q.key} question={q} index={i} total={draft.questions.length} errors={errors.questions[q.key] ?? {}} />
              ))}
              <div className="row">
                <button type="button" className="btn btn--lg" onClick={() => store.addQuestion('mcq')}>+ Multiple choice</button>
                <button type="button" className="btn" onClick={() => store.addQuestion('short')}>+ Short answer</button>
                <button type="button" className="btn" onClick={() => store.addQuestion('long')}>+ Long answer</button>
              </div>
            </div>
          )}
          {tab === 'examinee' && <ExamineeSchemaBuilder errors={errors.fields} />}
          {tab === 'settings' && (
            <div className="card">
              <QuizSettingsForm errors={errors.form} />
            </div>
          )}
        </fieldset>
      </main>
    </>
  );
}
