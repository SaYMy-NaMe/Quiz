import { describe, it, expect } from 'vitest';
import { diagnose, describeUri } from './mongoose';

describe('MongoDB connection diagnostics', () => {
  it('explains the Atlas IP allow-list failure and masks credentials', () => {
    expect(diagnose(new Error('80305BF501000000:error:0A000438:SSL routines:ssl3_read_bytes:tlsv1 alert internal error'))).toMatch(/Network Access/);
    expect(diagnose(new Error('bad auth : authentication failed'))).toMatch(/credentials/);
    expect(diagnose(new Error('querySrv ENOTFOUND _mongodb._tcp.nope'))).toMatch(/hostname/);
    expect(describeUri('mongodb+srv://user:p%40ss@cluster0.x.mongodb.net/db')).toBe('mongodb+srv://user:***@cluster0.x.mongodb.net/db');
  });
});
