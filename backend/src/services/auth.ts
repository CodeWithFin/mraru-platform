import { createHash, randomBytes } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { env } from '../env.js';

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenClaims {
  type: 'access';
  /** member id */
  sub: string;
  chamaId: string;
  role: string;
  status: string;
  isFounder: boolean;
  chamaSlug: string;
}

export interface OtpGrantClaims {
  type: 'otp-grant';
  phone: string;
  purpose: string;
  /** one-time nonce bound to the verified OTP record */
  jti: string;
}

export async function signAccessToken(claims: Omit<AccessTokenClaims, 'type'>): Promise<string> {
  return new SignJWT({ ...claims, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mraru-api')
    .setAudience('mraru-app')
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey, {
    issuer: 'mraru-api',
    audience: 'mraru-app',
  });
  if (payload.type !== 'access' || typeof payload.sub !== 'string' || typeof payload.chamaId !== 'string') {
    throw new Error('Invalid access token payload');
  }
  return {
    type: 'access',
    sub: payload.sub,
    chamaId: payload.chamaId,
    role: String(payload.role ?? 'member'),
    status: String(payload.status ?? ''),
    isFounder: Boolean(payload.isFounder),
    chamaSlug: String(payload.chamaSlug ?? ''),
  };
}

/**
 * Short-lived, purpose-bound credential minted only after an OTP has been
 * verified. The chama-creation and join endpoints require it, so a verified
 * phone number can never be reused outside its purpose or expiry window.
 */
export async function signOtpGrant(claims: { phone: string; purpose: string; jti: string }): Promise<string> {
  return new SignJWT({ ...claims, type: 'otp-grant' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mraru-api')
    .setAudience('mraru-app')
    .setExpirationTime(env.JWT_OTP_GRANT_TTL)
    .sign(secretKey);
}

export async function verifyOtpGrant(token: string): Promise<OtpGrantClaims> {
  const { payload } = await jwtVerify(token, secretKey, {
    issuer: 'mraru-api',
    audience: 'mraru-app',
  });
  if (payload.type !== 'otp-grant' || typeof payload.phone !== 'string' || typeof payload.purpose !== 'string') {
    throw new Error('Invalid OTP grant payload');
  }
  return {
    type: 'otp-grant',
    phone: payload.phone,
    purpose: String(payload.purpose),
    jti: String(payload.jti ?? ''),
  };
}

/* ------------------------------------------------------------------ */
/* Refresh tokens (opaque, hashed at rest, rotated on every use)       */
/* ------------------------------------------------------------------ */

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: sha256(token) };
}

export function hashRefreshToken(token: string): string {
  return sha256(token);
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Encode the member's status into a fresh access token. */
export async function buildAccessToken(member: {
  id: string;
  chamaId: string;
  role: string;
  status: string;
  isFounder: boolean;
} & { chamaSlug?: string | null }): Promise<string> {
  return signAccessToken({
    sub: member.id,
    chamaId: member.chamaId,
    role: member.role,
    status: member.status,
    isFounder: member.isFounder,
    chamaSlug: member.chamaSlug ?? '',
  });
}
