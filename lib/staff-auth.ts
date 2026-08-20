import { cookies } from 'next/headers';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export const STAFF_COOKIE = 'gizops_staff_session';
const MAX_AGE_PERSONAL = 60 * 60 * 8;
const MAX_AGE_TRUSTED = 60 * 60 * 12;

export type StaffSession = {
  employeeId: string;
  accountId: string;
  role: string;
  credentialVersion: number;
  locationId?: string | null;
  eventId?: string | null;
  device: 'personal' | 'trusted';
  exp: number;
};

function secret() {
  const value = process.env.STAFF_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('STAFF_SESSION_SECRET is required.');
  return value;
}

export function hashStaffSecret(value: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(value, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyStaffSecret(value: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, salt, expected] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = scryptSync(value, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createStaffToken(input: Omit<StaffSession, 'exp'>) {
  const maxAge = input.device === 'trusted' ? MAX_AGE_TRUSTED : MAX_AGE_PERSONAL;
  const payload = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + maxAge * 1000 })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, maxAge };
}

export function readStaffToken(raw?: string | null): StaffSession | null {
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as StaffSession;
    return session.exp > Date.now() ? session : null;
  } catch { return null; }
}

export function getStaffSession() {
  return readStaffToken(cookies().get(STAFF_COOKIE)?.value);
}

export function staffCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge };
}
