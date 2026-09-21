import type { SchemaField } from '@/types';
import type { FormValues } from '../hooks/useDynamicValidation';

interface Props {
  fields: SchemaField[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  onBlur?: (fieldId: string) => void;
}

/** Renders instructor-defined fields at runtime; one control per field type. */
export function DynamicFormRenderer({ fields, values, errors, onChange, onBlur }: Props) {
  return (
    <>
      {fields.map((f) => {
        const id = `ex-${f.fieldId}`;
        const error = errors[f.fieldId];
        const common = {
          id,
          name: f.fieldId,
          'aria-invalid': error ? ('true' as const) : undefined,
          'aria-describedby': error ? `${id}-err` : undefined,
          required: f.required,
          onBlur: () => onBlur?.(f.fieldId),
        };
        return (
          <div className="field" key={f.fieldId}>
            <label className="field__label" htmlFor={id}>
              {f.label}
              {f.required && (
                <span className="req" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {f.type === 'select' ? (
              <select className="select" value={values[f.fieldId] ?? ''} onChange={(e) => onChange(f.fieldId, e.target.value)} {...common}>
                <option value="">{f.placeholder ?? 'Select…'}</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                placeholder={f.placeholder}
                value={values[f.fieldId] ?? ''}
                onChange={(e) => onChange(f.fieldId, e.target.value)}
                autoComplete={f.type === 'email' ? 'email' : 'off'}
                {...common}
              />
            )}
            {error && (
              <span className="field__error" id={`${id}-err`} role="alert">
                {error}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
