import { z, type ZodTypeAny } from 'zod';
import type { ExamineeRecord, SchemaField, SchemaFieldType } from '../types/schema-field';

/**
 * Builder + Composite Pattern.
 *
 * `FieldValidatorFactory` turns one persisted `SchemaField` into a leaf Zod
 * validator; `ExamineeSchemaBuilder` composes leaves into the object schema
 * the examinee form is validated against at runtime. The same module runs in
 * the browser (inline feedback) and on the server (authoritative check).
 */
type LeafBuilder = (field: SchemaField) => ZodTypeAny;

const requiredMsg = (f: SchemaField) => `${f.label} is required`;

const leaves: Record<SchemaFieldType, LeafBuilder> = {
  text: (f) => {
    const base = z.string({ required_error: requiredMsg(f) }).trim().max(200, `${f.label} is too long`);
    return f.required ? base.min(1, requiredMsg(f)) : base.optional().or(z.literal(''));
  },
  email: (f) => {
    const base = z.string({ required_error: requiredMsg(f) }).trim().toLowerCase().max(200);
    return f.required
      ? base.min(1, requiredMsg(f)).email(`${f.label} must be a valid email`)
      : base.email(`${f.label} must be a valid email`).optional().or(z.literal(''));
  },
  number: (f) => {
    const base = z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v),
      f.required
        ? z.number({ required_error: requiredMsg(f), invalid_type_error: `${f.label} must be a number` }).finite()
        : z.number({ invalid_type_error: `${f.label} must be a number` }).finite().optional(),
    );
    return base;
  },
  select: (f) => {
    const options = f.options ?? [];
    if (options.length === 0) return z.string().optional();
    const [first, ...rest] = options as [string, ...string[]];
    const enumSchema = z.enum([first, ...rest], {
      errorMap: () => ({ message: `Choose one of the listed options for ${f.label}` }),
    });
    return f.required ? enumSchema : enumSchema.optional().or(z.literal(''));
  },
};

export const FieldValidatorFactory = {
  create(field: SchemaField): ZodTypeAny {
    return leaves[field.type](field);
  },
};

export class ExamineeSchemaBuilder {
  private readonly shape: Record<string, ZodTypeAny> = {};

  addField(field: SchemaField): this {
    this.shape[field.fieldId] = FieldValidatorFactory.create(field);
    return this;
  }

  addFields(fields: SchemaField[]): this {
    fields.forEach((f) => this.addField(f));
    return this;
  }

  /** Unknown keys are stripped so examinees can't smuggle arbitrary data into exports. */
  build() {
    return z.object(this.shape).strip();
  }

  static fromFields(fields: SchemaField[]) {
    return new ExamineeSchemaBuilder().addFields(fields).build();
  }
}

export interface ExamineeValidationResult {
  success: boolean;
  data?: ExamineeRecord;
  errors: Record<string, string>;
}

/** Convenience wrapper returning a flat `fieldId -> message` error map. */
export function validateExaminee(fields: SchemaField[], input: unknown): ExamineeValidationResult {
  const result = ExamineeSchemaBuilder.fromFields(fields).safeParse(input ?? {});
  if (result.success) {
    const data: ExamineeRecord = {};
    for (const [k, v] of Object.entries(result.data as Record<string, unknown>)) {
      if (v === undefined || v === '') continue;
      data[k] = v as string | number;
    }
    return { success: true, data, errors: {} };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}

/** Picks the best human label for a leaderboard row from collected examinee data. */
export function displayNameFor(fields: SchemaField[], examinee: ExamineeRecord): string {
  const preferred = ['name', 'full_name', 'fullname', 'student_name', 'studentName', 'student_id', 'studentId', 'email'];
  for (const key of preferred) {
    const v = examinee[key];
    if (v !== undefined && String(v).trim()) return String(v);
  }
  for (const f of fields) {
    const v = examinee[f.fieldId];
    if (f.type !== 'number' && v !== undefined && String(v).trim()) return String(v);
  }
  const first = Object.values(examinee)[0];
  return first !== undefined ? String(first) : 'Anonymous';
}
