import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Credentials, Instructor, RegisterPayload } from '@shared';
import { UserModel, type UserDoc } from './user.model';
import { env, isProduction } from '@/config/env';
import { conflict, unauthorized } from '@/utils/errors';

export const TOKEN_TTL_SECONDS = 72 * 3600;
const BCRYPT_ROUNDS = isProduction ? 12 : 8;
// Compared against when the email is unknown so response time doesn't reveal account existence.
const DUMMY_HASH = '$2a$08$CwTycUXWue0Thq9StjUM0uJ8i0pO1ZlZ2V1oLqZvQ1YhE7v5lQb3a';

interface TokenClaims {
  sub: string;
  email: string;
  name: string;
}

export const toInstructor = (u: UserDoc): Instructor => ({ id: u._id.toString(), email: u.email, name: u.name, createdAt: u.createdAt.toISOString() });

export function signToken(instructor: Instructor): string {
  const claims: TokenClaims = { sub: instructor.id, email: instructor.email, name: instructor.name };
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

/** Returns the instructor encoded in a valid token, or null. */
export function verifyToken(token: string): Instructor | null {
  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as TokenClaims & { iat: number };
    return { id: claims.sub, email: claims.email, name: claims.name, createdAt: new Date(claims.iat * 1000).toISOString() };
  } catch {
    return null;
  }
}

export async function register({ email, password, name }: RegisterPayload): Promise<Instructor> {
  const normalized = email.trim().toLowerCase();
  if (await UserModel.exists({ email: normalized })) throw conflict('An account with this email already exists');
  const user = await UserModel.create({ email: normalized, name: name.trim(), passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  return toInstructor(user);
}

export async function login({ email, password }: Credentials): Promise<Instructor> {
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Invalid email or password');
  return toInstructor(user);
}
