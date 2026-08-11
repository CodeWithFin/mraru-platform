import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';

import { db, withTenant } from '../../db/client.js';
import { authIdentities, chamas, members } from '../../db/schema.js';
import { HttpError } from '../../lib/errors.js';
import { decryptSecret, redactNationalId } from '../../lib/crypto.js';
import { verifyPassword } from '../../lib/password.js';
import { assertOtpGrantValid, requestOtp, verifyOtp } from '../../services/otp.service.js';
import { issueTokens, loadMember, rotateRefreshToken } from '../../services/session.js';
import { hashPassword } from '../../lib/password.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  loginOtpSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshSchema,
} from '../../lib/validators.js';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  /* ------------------------- OTP ------------------------- */

  app.post('/auth/otp/send', async (req, reply) => {
    const body = otpSendSchema.parse(req.body);
    const result = await requestOtp({ phone: body.phone, purpose: body.purpose, ip: req.clientIp ?? 'unknown' });
    return reply.code(200).send({
      message: 'Verification code sent',
      expiresInSeconds: 300,
      devCode: result.devCode, // present only when SMS_PROVIDER=dev
    });
  });

  app.post('/auth/otp/verify', async (req, reply) => {
    const body = otpVerifySchema.parse(req.body);
    const { grant } = await verifyOtp({ phone: body.phone, code: body.code, purpose: body.purpose });

    // purpose=login: swap the grant for real tokens right away
    if (body.purpose === 'login') {
      return loginWithPhone(req, reply, { phone: body.phone, grant });
    }
    return reply.code(200).send({ grant });
  });

  /* ------------------------- Password login ------------------------- */

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const identities = await db.query.authIdentities.findMany({ where: eq(authIdentities.phone, body.phone) });
    if (identities.length === 0) throw HttpError.unauthorized('Invalid phone number or password');

    const matches: { memberId: string; chamaId: string; role: string; status: string; isFounder: boolean }[] = [];

    for (const identity of identities) {
      if (body.chamaId && identity.chamaId !== body.chamaId) continue;
      const member = await loadMember(identity.chamaId, identity.memberId);
      if (!member?.passwordHash) continue;
      if (member.status === 'rejected' || member.status === 'exited') continue;
      if (await verifyPassword(body.password, member.passwordHash)) {
        matches.push({
          memberId: member.id,
          chamaId: identity.chamaId,
          role: member.role,
          status: member.status,
          isFounder: member.isFounder,
        });
      }
    }

    if (matches.length === 0) throw HttpError.unauthorized('Invalid phone number or password');

    if (body.chamaId) {
      const chosen = matches.find((m) => m.chamaId === body.chamaId);
      if (!chosen) throw HttpError.unauthorized('Invalid credentials for this chama');
      return completeLogin(reply, chosen);
    }

    if (matches.length === 1) {
      return completeLogin(reply, matches[0]!);
    }

    // Ambiguous: the phone belongs to several chamas — return choices.
    const options = await Promise.all(
      matches.map(async (m) => {
        const chama = await withTenant(m.chamaId, (tx) =>
          tx.query.chamas.findFirst({ where: eq(chamas.id, m.chamaId) }),
        );
        return {
          chamaId: m.chamaId,
          name: chama?.name ?? null,
          slug: chama?.slug ?? null,
          role: m.role,
        };
      }),
    );
    throw HttpError.conflict('This phone belongs to multiple chamas — choose one', { chamas: options });
  });

  /* ------------------------- OTP login ------------------------- */

  app.post('/auth/login/otp', async (req, reply) => {
    const body = loginOtpSchema.parse(req.body);
    const { grant } = await verifyOtp({ phone: body.phone, code: body.code, purpose: 'login' });
    return loginWithPhone(req, reply, { phone: body.phone, grant, chamaId: body.chamaId });
  });

  /* ------------------------- Password reset ------------------------- */

  app.post('/auth/password-reset/request', async (req, reply) => {
    const body = passwordResetRequestSchema.parse(req.body);
    // Always 200 (even for unknown numbers) to avoid number enumeration.
    await requestOtp({ phone: body.phone, purpose: 'password_reset', ip: req.clientIp ?? 'unknown' }).catch(() => null);
    return reply.code(200).send({ message: 'If the number is registered, a reset code has been sent' });
  });

  // Password reset is guarded by OTP re-verification, not an email link.
  app.post('/auth/password-reset/confirm', async (req, reply) => {
    const body = passwordResetConfirmSchema.parse(req.body);
    await assertOtpGrantValid(body.grant, { purpose: 'password_reset', phone: body.phone });

    const identityRows = await db.query.authIdentities.findMany({ where: eq(authIdentities.phone, body.phone) });
    if (identityRows.length === 0) throw HttpError.unauthorized('No account found for this number');

    const newHash = await hashPassword(body.newPassword);
    for (const identity of identityRows) {
      await withTenant(identity.chamaId, async (tx) => {
        await tx.update(members).set({ passwordHash: newHash }).where(eq(members.id, identity.memberId));
      });
    }
    return reply.code(200).send({ message: 'Password updated. You can now log in.' });
  });

  /* ------------------------- Refresh ------------------------- */

  app.post('/auth/refresh', async (req, reply) => {
    const body = refreshSchema.parse(req.body);
    const tokens = await rotateRefreshToken(body.refreshToken);
    return reply.code(200).send({ tokens });
  });

  /* ------------------------- Me ------------------------- */

  app.get('/auth/me', { preHandler: [requireAuth()] }, async (req, reply) => {
    const auth = req.auth!;
    const member = await loadMember(auth.chamaId, auth.sub);
    if (!member) throw HttpError.unauthorized('Account no longer exists');

    return reply.code(200).send({
      member: {
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
        email: member.email,
        nationalIdRedacted: redactNationalId(decryptSecret(member.nationalIdEncrypted)),
        role: member.role,
        status: member.status,
        isFounder: member.isFounder,
        kycStatus: member.kycStatus,
        nextOfKin: {
          name: member.nextOfKinName,
          phone: member.nextOfKinPhone,
          relationship: member.nextOfKinRelationship,
        },
      },
      chama: {
        id: member.chama.id,
        name: member.chama.name,
        slug: member.chama.slug,
        joinCode: member.chama.joinCode,
        status: member.chama.status,
        chamaType: member.chama.chamaType,
        votingModel: member.chama.votingModel,
        lendingEnabled: member.chama.lendingEnabled,
        minimumContribution: member.chama.minimumContribution,
        contributionDueDay: member.chama.contributionDueDay,
      },
    });
  });
}

/* ------------------------- shared helpers ------------------------- */

async function completeLogin(
  reply: import('fastify').FastifyReply,
  m: { memberId: string; chamaId: string; role: string; status: string; isFounder: boolean },
) {
  const member = await loadMember(m.chamaId, m.memberId);
  if (!member) throw HttpError.unauthorized('Account no longer exists');
  const tokens = await issueTokens({
    id: member.id,
    chamaId: member.chamaId,
    role: member.role,
    status: member.status,
    isFounder: member.isFounder,
    chamaSlug: member.chama.slug,
  });
  return reply.code(200).send({
    tokens,
    member: {
      id: member.id,
      fullName: member.fullName,
      role: member.role,
      status: member.status,
      isFounder: member.isFounder,
    },
    chama: { id: member.chama.id, name: member.chama.name, slug: member.chama.slug, status: member.chama.status },
  });
}

async function loginWithPhone(
  req: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
  opts: { phone: string; grant: string; chamaId?: string },
) {
  // The grant proves the OTP was verified; now resolve memberships.
  const identities = await db.query.authIdentities.findMany({ where: eq(authIdentities.phone, opts.phone) });
  const valid = identities.filter((i) => !opts.chamaId || i.chamaId === opts.chamaId);

  if (valid.length === 0) throw HttpError.unauthorized('No account found for this number');
  if (valid.length > 1 && !opts.chamaId) {
    const options = await Promise.all(
      valid.map(async (i) => {
        const chama = await withTenant(i.chamaId, (tx) => tx.query.chamas.findFirst({ where: eq(chamas.id, i.chamaId) }));
        return { chamaId: i.chamaId, name: chama?.name ?? null, slug: chama?.slug ?? null };
      }),
    );
    throw HttpError.conflict('This phone belongs to multiple chamas — choose one', { chamas: options });
  }

  const identity = valid[0]!;
  const member = await loadMember(identity.chamaId, identity.memberId);
  if (!member || member.status === 'rejected' || member.status === 'exited') {
    throw HttpError.unauthorized('Account cannot log in');
  }
  const tokens = await issueTokens({
    id: member.id,
    chamaId: member.chamaId,
    role: member.role,
    status: member.status,
    isFounder: member.isFounder,
    chamaSlug: member.chama.slug,
  });
  return reply.code(200).send({
    tokens,
    member: { id: member.id, fullName: member.fullName, role: member.role, status: member.status },
    chama: { id: member.chama.id, name: member.chama.name, slug: member.chama.slug, status: member.chama.status },
  });
}


