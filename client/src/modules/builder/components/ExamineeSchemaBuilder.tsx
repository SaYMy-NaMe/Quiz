import { useEditorStore } from '@/store/editor.store';
import type { DraftSchemaField } from '@/types';

const TYPE_LABELS: Record<DraftSchemaField['type'], string> = {
  text: 'Short answer',
  number: 'Number',
  email: 'Email',
  select: 'Dropdown',
};

const PRESETS: Omit<DraftSchemaField, 'key'>[] = [
  { fieldId: 'student_id', label: 'Student ID', type: 'text', required: true, options: [], placeholder: '' },
  { fieldId: 'name', label: 'Name', type: 'text', required: true, options: [], placeholder: 'Jane Doe' },
  { fieldId: 'email', label: 'Email', type: 'email', required: true, options: [], placeholder: 'you@school.edu' },
  { fieldId: 'course_code', label: 'Course Code', type: 'text', required: true, options: [], placeholder: 'CSE-101' },
  { fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B', 'C'], placeholder: '' },
];

const slugify = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'f$1')
    .slice(0, 40);

interface Props {
  errors: Record<string, Record<string, string>>;
}

/**
 * Google-Forms-style builder for the Step-1 examinee info form. Each card is one
 * metadata field with a type selector, required toggle and (for dropdowns) choices.
 */
export function ExamineeSchemaBuilder({ errors }: Props) {
  const fields = useEditorStore((s) => s.draft.examineeFields);
  const { addField, removeField, moveField, updateField, duplicateField } = useEditorStore();
  const addPreset = (preset: Omit<DraftSchemaField, 'key'>) => {
    addField();
    const last = useEditorStore.getState().draft.examineeFields.at(-1);
    if (last) updateField(last.key, preset);
  };

  return (
    <div>
      <section className="gf-card gf-card--title">
        <h2 className="gf-card__title">Examinee details (Step 1)</h2>
        <p className="gf-card__desc">
          Examinees fill this form before the exam starts. No timer or proctoring runs during this step. Every field becomes a
          column in the Excel export.
        </p>
        <div className="gf-add">
          <span className="small muted">Quick add:</span>
          {PRESETS.map((p) => (
            <button key={p.fieldId} type="button" className="btn btn--sm" onClick={() => addPreset(p)} disabled={fields.some((f) => f.fieldId === p.fieldId)}>
              + {p.label}
            </button>
          ))}
        </div>
      </section>

      {fields.length === 0 && <div className="alert alert--info">No fields yet — examinees will go straight to the "Start Quiz" screen.</div>}

      {fields.map((f, i) => {
        const e = errors[f.key] ?? {};
        return (
          <section className="gf-card" key={f.key} aria-label={`Field ${i + 1}`}>
            <div className="gf-field-head">
              <div className="field" style={{ marginBottom: 0 }}>
                <input
                  className="gf-input"
                  value={f.label}
                  placeholder="Question label (e.g. Student ID)"
                  aria-label={`Field ${i + 1} label`}
                  onChange={(ev) => {
                    const label = ev.target.value;
                    const autoId = !f.fieldId || f.fieldId === slugify(f.label);
                    updateField(f.key, { label, ...(autoId ? { fieldId: slugify(label) } : {}) });
                  }}
                  aria-invalid={e.label ? 'true' : undefined}
                />
                {e.label && <span className="field__error" role="alert">{e.label}</span>}
              </div>
              <select className="select" value={f.type} aria-label="Field type" onChange={(ev) => updateField(f.key, { type: ev.target.value as DraftSchemaField['type'] })}>
                {(Object.keys(TYPE_LABELS) as DraftSchemaField['type'][]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="form-grid" style={{ marginTop: '0.75rem' }}>
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-id`}>Column key</label>
                <input id={`${f.key}-id`} className="input mono" value={f.fieldId} onChange={(ev) => updateField(f.key, { fieldId: ev.target.value })} aria-invalid={e.fieldId ? 'true' : undefined} />
                <span className="field__hint">Used as the export column key</span>
                {e.fieldId && <span className="field__error" role="alert">{e.fieldId}</span>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-ph`}>Placeholder</label>
                <input id={`${f.key}-ph`} className="input" value={f.placeholder} onChange={(ev) => updateField(f.key, { placeholder: ev.target.value })} />
              </div>
            </div>

            {f.type === 'select' && (
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-opts`}>Dropdown choices (one per line)</label>
                <textarea id={`${f.key}-opts`} className="textarea" value={f.options.join('\n')} onChange={(ev) => updateField(f.key, { options: ev.target.value.split('\n') })} aria-invalid={e.options ? 'true' : undefined} />
                {e.options && <span className="field__error" role="alert">{e.options}</span>}
              </div>
            )}

            <div className="gf-toolbar">
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveField(f.key, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveField(f.key, 1)} disabled={i === fields.length - 1} aria-label="Move down">↓</button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => duplicateField(f.key)} aria-label="Duplicate field">⧉ Duplicate</button>
              <button type="button" className="btn btn--sm btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => removeField(f.key)} aria-label="Delete field">🗑 Delete</button>
              <span className="gf-toolbar__sep" aria-hidden="true" />
              <label className="switch">
                <input type="checkbox" checked={f.required} onChange={(ev) => updateField(f.key, { required: ev.target.checked })} />
                <span>Required</span>
              </label>
            </div>
          </section>
        );
      })}

      <button type="button" className="btn btn--lg" onClick={addField}>+ Add field</button>
    </div>
  );
}
