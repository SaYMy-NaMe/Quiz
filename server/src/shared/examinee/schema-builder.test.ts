import { describe, it, expect } from 'vitest';
import { validateExaminee, displayNameFor } from '@shared';
import type { SchemaField } from '@shared';

const fields: SchemaField[] = [
  { fieldId: 'student_id', label: 'Student ID', type: 'text', required: true },
  { fieldId: 'email', label: 'Email', type: 'email', required: true },
  { fieldId: 'section', label: 'Section', type: 'select', required: true, options: ['A', 'B'] },
  { fieldId: 'age', label: 'Age', type: 'number', required: false },
];

describe('dynamic examinee schema', () => {
  it('coerces, normalises and strips unknown keys', () => {
    const r = validateExaminee(fields, { student_id: '42', email: 'X@Y.io', section: 'A', age: '19', junk: 1 });
    expect(r.data).toEqual({ student_id: '42', email: 'x@y.io', section: 'A', age: 19 });
  });
  it('reports per-field errors', () => {
    const r = validateExaminee(fields, { email: 'nope', section: 'Z', age: 'abc' });
    expect(Object.keys(r.errors).sort()).toEqual(['age', 'email', 'section', 'student_id']);
  });
  it('derives display names', () => {
    expect(displayNameFor(fields, { student_id: 'S1' })).toBe('S1');
    expect(displayNameFor(fields, {})).toBe('Anonymous');
  });
});
