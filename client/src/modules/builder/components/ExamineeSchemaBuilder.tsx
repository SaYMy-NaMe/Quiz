import { useEditorStore } from '@/store/editor.store';
import type { DraftSchemaField } from '@/types';

const TYPE_LABELS: Record<DraftSchemaField['type'], string> = {
  text: 'Short text',
  number: 'Number',
  email: 'Email',
  select: 'Dropdown',
};

const PRESETS: Omit<DraftSchemaField, 'key'>[] = [
  { fieldId: 'name', label: 'Full name', type: 'text', required: true, options: [], placeholder: 'Jane Doe' },
  { fieldId: 'student_id', label: 'Student ID', type: 'text', required: true, options: [], placeholder: '' },
  { fieldId: 'email', label: 'Email', type: 'email', required: true, options: [], placeholder: 'you@school.edu' },
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
 * Google-Forms-inspired builder: each card is one examinee metadata field with a
 * type selector, required toggle and (for dropdowns) an editable option list.
 */
export function ExamineeSchemaBuilder({ errors }: Props) {
  const fields = useEditorStore((s) => s.draft.examineeFields);
  const { addField, removeField, moveField, updateField } = useEditorStore();
  const addPreset = (preset: Omit<DraftSchemaField, 'key'>) => {
    addField();
    const last = useEditorStore.getState().draft.examineeFields.at(-1);
    if (last) updateField(last.key, preset);
  };

  return (
    <div className="stack">
      <div className="card card--flat">
        <h3>Examinee details form</h3>
        <p className="muted small">
          Examinees fill this form before the timer starts. Every field becomes a column in the Excel export.
        </p>
        <div className="row">
          <span className="small muted">Quick add:</span>
          {PRESETS.map((p) => (
            <button
              key={p.fieldId}
              type="button"
              className="btn btn--sm"
              onClick={() => addPreset(p)}
              disabled={fields.some((f) => f.fieldId === p.fieldId)}
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>

      {fields.length === 0 && (
        <div className="alert alert--info">No fields yet — examinees will go straight to the test.</div>
      )}

      {fields.map((f, i) => {
        const e = errors[f.key] ?? {};
        return (
          <section className="builder-item" key={f.key} aria-label={`Field ${i + 1}`}>
            <div className="builder-item__head">
              <strong>Field {i + 1}</strong>
              <div className="row">
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveField(f.key, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveField(f.key, 1)} disabled={i === fields.length - 1} aria-label="Move down">↓</button>
                <button type="button" className="btn btn--sm btn--danger" onClick={() => removeField(f.key)}>Remove</button>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-label`}>Label<span className="req" aria-hidden="true">*</span></label>
                <input
                  id={`${f.key}-label`}
                  className="input"
                  value={f.label}
                  placeholder="e.g. Student ID"
                  onChange={(ev) => {
                    const label = ev.target.value;
                    const autoId = !f.fieldId || f.fieldId === slugify(f.label);
                    updateField(f.key, { label, ...(autoId ? { fieldId: slugify(label) } : {}) });
                  }}
                  aria-invalid={e.label ? 'true' : undefined}
                />
                {e.label && <span className="field__error" role="alert">{e.label}</span>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-id`}>Field id</label>
                <input id={`${f.key}-id`} className="input mono" value={f.fieldId} onChange={(ev) => updateField(f.key, { fieldId: ev.target.value })} aria-invalid={e.fieldId ? 'true' : undefined} />
                <span className="field__hint">Column key in exports</span>
                {e.fieldId && <span className="field__error" role="alert">{e.fieldId}</span>}
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-type`}>Type</label>
                <select id={`${f.key}-type`} className="select" value={f.type} onChange={(ev) => updateField(f.key, { type: ev.target.value as DraftSchemaField['type'] })}>
                  {(Object.keys(TYPE_LABELS) as DraftSchemaField['type'][]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-ph`}>Placeholder</label>
                <input id={`${f.key}-ph`} className="input" value={f.placeholder} onChange={(ev) => updateField(f.key, { placeholder: ev.target.value })} />
              </div>
            </div>

            {f.type === 'select' && (
              <div className="field">
                <label className="field__label" htmlFor={`${f.key}-opts`}>Choices (one per line)</label>
                <textarea
                  id={`${f.key}-opts`}
                  className="textarea"
                  value={f.options.join('\n')}
                  onChange={(ev) => updateField(f.key, { options: ev.target.value.split('\n') })}
                  aria-invalid={e.options ? 'true' : undefined}
                />
                {e.options && <span className="field__error" role="alert">{e.options}</span>}
              </div>
            )}

            <label className="switch">
              <input type="checkbox" checked={f.required} onChange={(ev) => updateField(f.key, { required: ev.target.checked })} />
              <span>Required</span>
            </label>
          </section>
        );
      })}

      <button type="button" className="btn btn--lg" onClick={addField}>+ Add field</button>
    </div>
  );
}
