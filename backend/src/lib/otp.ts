import { createHash, randomBytes, randomInt } from 'node:crypto';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Cryptographically random 6-digit code, zero-padded. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Hash a code with a fresh random salt. The stored value is useless to an
 * attacker with DB access, and prevents plaintext codes lingering at rest.
 */
export function hashOtpCode(code: string): string {
  const salt = randomBytes(8).toString('base64url');
  return `sha256:${salt}:${createHash('sha256').update(`${salt}:${code}`).digest('hex')}`;
}

export function verifyOtpHash(code: string, storedHash: string): boolean {
  const [scheme, salt, digest] = storedHash.split(':');
  if (scheme !== 'sha256' || !salt || !digest) return false;
  const candidate = createHash('sha256').update(`${salt}:${code}`).digest('hex');
  return candidate === digest;
}
