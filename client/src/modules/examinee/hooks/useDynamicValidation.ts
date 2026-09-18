import { useCallback, useMemo, useState } from 'react';
import { ExamineeSchemaBuilder, validateExaminee } from '@shared';
import type { ExamineeRecord, SchemaField } from '@/modules/quiz/types';

export type FormValues = Record<string, string>;

/**
 * Dynamic validation engine: synthesises a Zod schema from the instructor's
 * field configuration and validates on submit and on blur (per field).
 */
export function useDynamicValidation(fields: SchemaField[]) {
  const schema = useMemo(() => ExamineeSchemaBuilder.fromFields(fields), [fields]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateAll = useCallback(
    (values: FormValues): { ok: true; data: ExamineeRecord } | { ok: false } => {
      const result = validateExaminee(fields, values);
      setErrors(result.errors);
      return result.success && result.data ? { ok: true, data: result.data } : { ok: false };
    },
    [fields],
  );

  const validateField = useCallback(
    (fieldId: string, values: FormValues) => {
      const result = validateExaminee(fields, values);
      setErrors((prev) => {
        const next = { ...prev };
        const msg = result.errors[fieldId];
        if (msg) next[fieldId] = msg;
        else delete next[fieldId];
        return next;
      });
    },
    [fields],
  );

  const setServerErrors = useCallback((serverErrors: Record<string, string>) => setErrors(serverErrors), []);

  return { schema, errors, validateAll, validateField, setServerErrors };
}
