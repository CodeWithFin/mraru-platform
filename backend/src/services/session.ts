import { and, eq, isNull } from 'drizzle-orm';

import { db, withTenant } from '../db/client.js';
import { chamas, members, refreshTokens } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import {
  buildAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from './auth.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/** Issue an access token + a hashed-at-rest refresh token for a member. */
export async function issueTokens(member: {
  id: string;
  chamaId: string;
  role: string;
  status: string;
  isFounder: boolean;
  chamaSlug: string | null;
}): Promise<IssuedTokens> {
  const accessToken = await buildAccessToken(member);
  const { token, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    memberId: member.id,
    chamaId: member.chamaId,
    tokenHash: hash,
    expiresAt,
  });

  return { accessToken, refreshToken: token };
}

/**
 * Rotate a refresh token. On detection of a *reused* (already revoked) token,
 * revoke every token for that member — a classic token-theft signal.
 */
export async function rotateRefreshToken(rawToken: string): Promise<IssuedTokens> {
  const tokenHash = hashRefreshToken(rawToken);

  const existing = await db.query.refreshTokens.findFirst({
    where: and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)),
  });

  if (!existing) {
    // Reuse detection: was this token ever issued but already rotated/revoked?
    const revoked = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });
    if (revoked) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.memberId, revoked.memberId));
    }
    throw HttpError.unauthorized('Invalid refresh token');
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw HttpError.unauthorized('Refresh token expired');
  }

  // Revoke the current token and mint a replacement (rotation).
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, existing.id));

  const member = await withTenant(existing.chamaId, async (tx) => {
    const row = await tx.query.members.findFirst({
      where: and(eq(members.id, existing.memberId), eq(members.chamaId, existing.chamaId)),
      with: { chama: true },
    });
    return row;
  });

  if (!member) throw HttpError.unauthorized('Member no longer exists');

  return issueTokens({
    id: member.id,
    chamaId: member.chamaId,
    role: member.role,
    status: member.status,
    isFounder: member.isFounder,
    chamaSlug: member.chama.slug,
  });
}

/** Load a member with its chama, scoped to the tenant. */
export async function loadMember(chamaId: string, memberId: string) {
  return withTenant(chamaId, (tx) =>
    tx.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.chamaId, chamaId)),
      with: { chama: true },
    }),
  );
}
