import { describe, it, expect } from 'vitest';
import { validateExaminee } from '@shared';
import type { SchemaField } from '@/modules/quiz/types';

const fields: SchemaField[] = [
  { fieldId: 'name', label: 'Name', type: 'text', required: true },
  { fieldId: 'section', label: 'Section', type: 'select', required: false, options: ['A', 'B'] },
];

describe('client dynamic validation', () => {
  it('shares the exact schema semantics with the server', () => {
    expect(validateExaminee(fields, { name: 'x', section: '' }).data).toEqual({ name: 'x' });
    expect(validateExaminee(fields, { name: '' }).errors['name']).toMatch(/required/);
    expect(validateExaminee(fields, { name: 'x', section: 'C' }).errors['section']).toBeTruthy();
  });
});
