import { randomBytes } from 'node:crypto';
import { SHARE_TOKEN_LENGTH, INVITE_TOKEN_LENGTH } from '@shared';
import type { TokenIssuer } from '@/modules/quiz';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Generates URL-safe tokens from the CSPRNG. Rejection sampling keeps the
 * distribution uniform over the 64-symbol alphabet (6 bits per symbol) so a
 * 22-char token carries 132 bits of entropy — enumeration is infeasible.
 */
export function secureToken(length: number): string {
  let out = '';
  while (out.length < length) {
    const bytes = randomBytes(length);
    for (let i = 0; i < bytes.length && out.length < length; i++) {
      out += ALPHABET[bytes[i]! & 63];
    }
  }
  return out;
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export interface TokenService extends TokenIssuer {
  issueInviteToken(): string;
  isWellFormed(token: string): boolean;
}

export function createTokenService(): TokenService {
  return {
    issueShareToken: () => secureToken(SHARE_TOKEN_LENGTH),
    issueInviteToken: () => secureToken(INVITE_TOKEN_LENGTH),
    isWellFormed: (token) => TOKEN_PATTERN.test(token),
  };
}
