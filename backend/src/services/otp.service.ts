import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '../db/client.js';
import { otpVerifications, type OtpPurpose } from '../db/schema.js';
import { env } from '../env.js';
import { HttpError } from '../lib/errors.js';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_TTL_MS,
  OTP_WINDOW_MS,
  generateOtpCode,
  hashOtpCode,
  verifyOtpHash,
} from '../lib/otp.js';
import { RateLimiter } from '../lib/rateLimit.js';
import { signOtpGrant, verifyOtpGrant } from './auth.js';
import { enqueueSms } from './queue.js';

const ipLimiter = new RateLimiter(OTP_WINDOW_MS, 10, 'otp:ip');

export interface RequestOtpParams {
  phone: string;
  purpose: OtpPurpose;
  /** Requesting client IP — one of the two rate-limit dimensions (IP + phone). */
  ip: string;
}

export async function requestOtp({ phone, purpose, ip }: RequestOtpParams) {
  await ipLimiter.check(ip);

  // Phone-scoped cap (max 3 sends / phone / 10 min) is DB-backed so it
  // survives restarts and cannot be bypassed by clearing a cache.
  const recent = await db
    .select({ c: count() })
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.purpose, purpose),
        gt(otpVerifications.createdAt, new Date(Date.now() - OTP_WINDOW_MS)),
      ),
    );
  if ((recent[0]?.c ?? 0) >= OTP_MAX_SENDS_PER_WINDOW) {
    throw HttpError.tooManyRequests('Too many codes requested for this number — try again in 10 minutes');
  }

  const code = generateOtpCode();
  await db.insert(otpVerifications).values({
    phone,
    codeHash: hashOtpCode(code),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await enqueueSms({
    to: phone,
    text: `Your Mraru verification code is ${code}. It expires in 5 minutes. Never share it with anyone.`,
  });

  // Dev-only: surface the code so local flows can complete without SMS.
  return { devCode: env.SMS_PROVIDER === 'dev' ? code : undefined };
}

export interface VerifyOtpParams {
  phone: string;
  code: string;
  purpose: OtpPurpose;
}

/** Verify the newest pending code; on success mint a short-lived OTP grant. */
export async function verifyOtp({ phone, code, purpose }: VerifyOtpParams): Promise<{ grant: string }> {
  const record = await db.query.otpVerifications.findFirst({
    where: and(
      eq(otpVerifications.phone, phone),
      eq(otpVerifications.purpose, purpose),
      isNull(otpVerifications.verifiedAt),
      gt(otpVerifications.expiresAt, new Date()),
    ),
    orderBy: desc(otpVerifications.createdAt),
  });

  if (!record) throw HttpError.badRequest('No active verification code for this number');

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw HttpError.tooManyRequests('Too many incorrect attempts — request a new code');
  }

  if (!verifyOtpHash(code, record.codeHash)) {
    await db
      .update(otpVerifications)
      .set({ attempts: record.attempts + 1 })
      .where(eq(otpVerifications.id, record.id));
    throw HttpError.badRequest('Incorrect verification code');
  }

  await db
    .update(otpVerifications)
    .set({ verifiedAt: new Date(), attempts: record.attempts + 1 })
    .where(eq(otpVerifications.id, record.id));

  const grant = await signOtpGrant({ phone, purpose, jti: record.id });
  return { grant };
}

/**
 * Require a valid, verified OTP grant for `phone` + `purpose` before a
 * sensitive step (chama creation, joining, password reset). The grant is a
 * short-lived JWT bound to the verified OTP record — replaying a code or
 * guessing a grant is not possible.
 */
export async function assertOtpGrantValid(
  token: string,
  opts: { purpose: OtpPurpose; phone?: string },
): Promise<{ phone: string; purpose: string; jti: string }> {
  let claims: { phone: string; purpose: string; jti: string };
  try {
    claims = await verifyOtpGrant(token);
  } catch {
    throw HttpError.unauthorized('Invalid or expired verification grant');
  }
  if (claims.purpose !== opts.purpose || (opts.phone !== undefined && claims.phone !== opts.phone)) {
    throw HttpError.forbidden('Verification grant does not match this request');
  }
  const record = await db.query.otpVerifications.findFirst({
    where: and(
      eq(otpVerifications.id, claims.jti),
      eq(otpVerifications.phone, claims.phone),
      eq(otpVerifications.purpose, opts.purpose),
    ),
  });
  // The referenced OTP record must exist and have been verified.
  if (!record || !record.verifiedAt) {
    throw HttpError.forbidden('Verification grant is no longer valid');
  }
  return claims;
}
