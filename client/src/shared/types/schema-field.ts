/** Field types an instructor may configure for examinee onboarding. */
export type SchemaFieldType = 'text' | 'number' | 'email' | 'select';

/** Persisted JSON description of one examinee metadata field. */
export interface SchemaField {
  fieldId: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  /** Only meaningful for `select` fields. */
  options?: string[];
  placeholder?: string;
}

/** Runtime values collected from the examinee, keyed by `fieldId`. */
export type ExamineeRecord = Record<string, string | number>;
