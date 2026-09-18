import { describe, it, expect } from 'vitest';
import { validateExaminee, ExamineeSchemaBuilder, displayNameFor } from '@shared';
import type { SchemaField } from '@shared';

const fields: SchemaField[] = [
  { fieldId: 'student_id', label: 'Student ID', type: 'text', required: true },
  { fieldId: 'email', label: 'Email', type: 'email', required: true },
  { fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] },
  { fieldId: 'age', label: 'Age', type: 'number', required: false },
  { fieldId: 'nickname', label: 'Nickname', type: 'text', required: false },
];

describe('ExamineeSchemaBuilder', () => {
  it('composes a schema that accepts valid input and coerces numbers', () => {
    const r = validateExaminee(fields, { student_id: '42', email: 'X@Y.io', section: 'A', age: '19', nickname: '' });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ student_id: '42', email: 'x@y.io', section: 'A', age: 19 });
  });

  it('reports required, format and enum errors per field', () => {
    const r = validateExaminee(fields, { email: 'nope', section: 'Z', age: 'abc' });
    expect(r.success).toBe(false);
    expect(r.errors.student_id).toMatch(/required/);
    expect(r.errors.email).toMatch(/valid email/);
    expect(r.errors.section).toMatch(/Choose one/);
    expect(r.errors.age).toMatch(/number/);
  });

  it('strips unknown keys', () => {
    const schema = ExamineeSchemaBuilder.fromFields([fields[0]!]);
    expect(schema.parse({ student_id: 'a', hacker: 'x' })).toEqual({ student_id: 'a' });
  });

  it('accepts an empty schema', () => {
    expect(validateExaminee([], {}).success).toBe(true);
  });

  it('derives a display name', () => {
    expect(displayNameFor(fields, { student_id: 'S1', email: 'e@x.io' })).toBe('S1');
    expect(displayNameFor(fields, { age: 3 })).toBe('3');
    expect(displayNameFor(fields, {})).toBe('Anonymous');
  });
});
