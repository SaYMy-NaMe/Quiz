import { randomBytes } from 'node:crypto';
import { SHARE_TOKEN_LENGTH } from '@shared';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** URL-safe token from the CSPRNG: 6 bits per symbol ⇒ 132 bits at 22 chars. */
export function generateShareToken(length = SHARE_TOKEN_LENGTH): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! & 63] ?? '';
  return out;
}
