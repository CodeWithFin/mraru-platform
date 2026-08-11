import { randomBytes } from 'node:crypto';

import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';

import { db, setTenantOnTx, withPublicLookup, withTenant, type Tx } from '../db/client.js';
import {
  chamas,
  invites,
  kycDocuments,
  members,
  type MemberRole,
  type MemberStatus,
} from '../db/schema.js';
import { env } from '../env.js';
import { writeAudit } from '../lib/audit.js';
import { decryptSecret, redactNationalId } from '../lib/crypto.js';
import { HttpError } from '../lib/errors.js';
import { chamaRolesSatisfied } from '../lib/permissions.js';
import { enqueueSms } from './queue.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ------------------------------------------------------------------ */
/* Governance: a chama activates only when chairperson + treasurer +    */
/* secretary are all assigned to active members.                        */
/* ------------------------------------------------------------------ */

export async function recomputeChamaStatus(tx: Tx, chamaId: string): Promise<void> {
  const roleRows = await tx
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.chamaId, chamaId), eq(members.status, 'active')));

  const currentRow = await tx.select({ status: chamas.status }).from(chamas).where(eq(chamas.id, chamaId)).limit(1);
  const current = currentRow[0];
  if (!current) return;

  const satisfied = chamaRolesSatisfied(roleRows.map((r) => r.role));
  const next: 'active' | 'pending_setup' = satisfied ? 'active' : 'pending_setup';

  // Never auto-lift a suspension; that is a human decision.
  if (current.status === 'suspended' || current.status === next) return;

  await tx.update(chamas).set({ status: next, updatedAt: new Date() }).where(eq(chamas.id, chamaId));
  await writeAudit(tx, {
    chamaId,
    action: `chama.status.${next}`,
    entityType: 'chama',
    entityId: chamaId,
    beforeState: { status: current.status },
    afterState: { status: next },
  });
}

/** Assert the actor is an active member of the chama inside the tx. */
async function assertActiveActor(tx: Tx, chamaId: string, actorMemberId: string) {
  const actor = await tx.query.members.findFirst({
    where: and(eq(members.id, actorMemberId), eq(members.chamaId, chamaId)),
  });
  if (!actor || actor.status !== 'active') {
    throw HttpError.forbidden('Only active members can perform this action');
  }
  return actor;
}

/* ------------------------------------------------------------------ */
/* Approval queue                                                      */
/* ------------------------------------------------------------------ */

export interface PendingMemberRow {
  id: string;
  fullName: string;
  phone: string;
  nationalIdRedacted: string;
  role: MemberRole;
  status: MemberStatus;
  kycStatus: string;
  email: string | null;
  nextOfKin: { name: string | null; phone: string | null; relationship: string | null };
  kycDocuments: { kind: string; fileUrl: string }[];
  createdAt: Date;
}

export async function listPendingMembers(chamaId: string): Promise<PendingMemberRow[]> {
  return withTenant(chamaId, async (tx) => {
    const rows = await tx
      .select()
      .from(members)
      .where(and(eq(members.chamaId, chamaId), eq(members.status, 'pending_review')))
      .orderBy(asc(members.createdAt));

    const docRows = await tx
      .select({ memberId: kycDocuments.memberId, kind: kycDocuments.kind, fileUrl: kycDocuments.fileUrl })
      .from(kycDocuments)
      .where(eq(kycDocuments.chamaId, chamaId));

    const docsByMember = new Map<string, { kind: string; fileUrl: string }[]>();
    for (const d of docRows) {
      const list = docsByMember.get(d.memberId) ?? [];
      list.push({ kind: d.kind, fileUrl: d.fileUrl });
      docsByMember.set(d.memberId, list);
    }

    return rows.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      phone: m.phone,
      nationalIdRedacted: redactNationalId(decryptSecret(m.nationalIdEncrypted)),
      role: m.role,
      status: m.status,
      kycStatus: m.kycStatus,
      email: m.email,
      nextOfKin: {
        name: m.nextOfKinName,
        phone: m.nextOfKinPhone,
        relationship: m.nextOfKinRelationship,
      },
      kycDocuments: docsByMember.get(m.id) ?? [],
      createdAt: m.createdAt,
    }));
  });
}

export async function approveMember(chamaId: string, actorMemberId: string, memberId: string): Promise<void> {
  await withTenant(chamaId, async (tx) => {
    await assertActiveActor(tx, chamaId, actorMemberId);

    const target = await tx.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.chamaId, chamaId)),
    });
    if (!target) throw HttpError.notFound('Member not found');
    if (target.status !== 'pending_review') {
      throw HttpError.conflict(`Member is already ${target.status}`);
    }

    const docs = await tx.select({ c: count() }).from(kycDocuments).where(eq(kycDocuments.memberId, memberId));
    const hasDocs = (docs[0]?.c ?? 0) > 0;

    const before = { status: target.status, kycStatus: target.kycStatus, role: target.role };
    await tx
      .update(members)
      .set({
        status: 'active',
        approvedByMemberId: actorMemberId,
        approvedAt: new Date(),
        kycStatus: hasDocs ? 'approved' : target.kycStatus,
        rejectionReason: null,
        rejectedAt: null,
      })
      .where(eq(members.id, memberId));

    await writeAudit(tx, {
      chamaId,
      actorMemberId,
      action: 'member.approved',
      entityType: 'member',
      entityId: memberId,
      beforeState: before,
      afterState: { status: 'active', kycStatus: hasDocs ? 'approved' : target.kycStatus, approvedByMemberId: actorMemberId },
    });

    // Approving a Treasurer/Secretary may finally satisfy the activation rule.
    await recomputeChamaStatus(tx, chamaId);
  });

  // Welcome SMS after commit — never inside the tenant transaction.
  await sendWelcomeSms(chamaId, memberId);
}

export async function rejectMember(
  chamaId: string,
  actorMemberId: string,
  memberId: string,
  reason: string,
): Promise<void> {
  await withTenant(chamaId, async (tx) => {
    await assertActiveActor(tx, chamaId, actorMemberId);

    const target = await tx.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.chamaId, chamaId)),
    });
    if (!target) throw HttpError.notFound('Member not found');
    if (target.status !== 'pending_review') {
      throw HttpError.conflict(`Member is already ${target.status}`);
    }

    const before = { status: target.status };
    await tx
      .update(members)
      .set({ status: 'rejected', rejectionReason: reason, rejectedAt: new Date() })
      .where(eq(members.id, memberId));

    // Rejections are logged with a reason, never silently dropped.
    await writeAudit(tx, {
      chamaId,
      actorMemberId,
      action: 'member.rejected',
      entityType: 'member',
      entityId: memberId,
      beforeState: before,
      afterState: { status: 'rejected', reason },
    });
  });
}

async function sendWelcomeSms(chamaId: string, memberId: string): Promise<void> {
  const info = await withTenant(chamaId, async (tx) => {
    const row = await tx.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.chamaId, chamaId)),
      with: { chama: true },
    });
    return row ? { phone: row.phone, chamaName: row.chama.name } : null;
  });
  if (info) {
    await enqueueSms({
      to: info.phone,
      text: `🎉 Welcome to ${info.chamaName} on Mraru! Your membership is now active.`,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Invites                                                             */
/* ------------------------------------------------------------------ */

export async function inviteMember(params: {
  chamaId: string;
  actorMemberId: string;
  phone: string;
  role: MemberRole;
}): Promise<{ inviteId: string; slug: string; chamaName: string }> {
  const result = await withTenant(params.chamaId, async (tx) => {
    await assertActiveActor(tx, params.chamaId, params.actorMemberId);

    const chama = await tx.query.chamas.findFirst({ where: eq(chamas.id, params.chamaId) });
    if (!chama) throw HttpError.notFound('Chama not found');

    const existing = await tx.query.members.findFirst({
      where: and(eq(members.chamaId, params.chamaId), eq(members.phone, params.phone)),
    });
    if (existing && existing.status !== 'rejected') {
      throw HttpError.conflict('This phone number is already associated with the chama');
    }

    const code = randomBytes(24).toString('base64url');
    const [invite] = (await tx
      .insert(invites)
      .values({
        chamaId: params.chamaId,
        phone: params.phone,
        role: params.role,
        kind: 'invite_link',
        code,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdByMemberId: params.actorMemberId,
      })
      .returning()) as [typeof invites.$inferSelect];

    await writeAudit(tx, {
      chamaId: params.chamaId,
      actorMemberId: params.actorMemberId,
      action: 'invite.created',
      entityType: 'invite',
      entityId: invite.id,
      afterState: { phone: params.phone, role: params.role, expiresAt: invite.expiresAt.toISOString() },
    });

    return { invite, chama };
  });

  // SMS invite link, delivered after commit.
  const link = `${env.APP_BASE_URL}/join/${result.chama.slug}?invite=${result.invite.code}`;
  await enqueueSms({
    to: params.phone,
    text: `You've been invited to join ${result.chama.name} on Mraru as ${params.role}. Open: ${link} (expires in 7 days)`,
  });

  return {
    inviteId: result.invite.id,
    slug: result.chama.slug,
    chamaName: result.chama.name,
    // Dev-only: expose the link so local flows work without SMS delivery.
    devLink: env.SMS_PROVIDER === 'dev' ? link : undefined,
  };
}

export async function listInvites(chamaId: string) {
  return withTenant(chamaId, async (tx) => {
    const rows = await tx
      .select()
      .from(invites)
      .where(eq(invites.chamaId, chamaId))
      .orderBy(desc(invites.createdAt));
    return rows.map((i) => ({
      id: i.id,
      phone: i.phone,
      role: i.role,
      status: i.usedAt ? 'used' : i.expiresAt.getTime() < Date.now() ? 'expired' : 'pending',
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      usedAt: i.usedAt,
    }));
  });
}

/** Look up a chama by join code or invite token for the join screen. */
export async function resolveJoinTarget(slug: string, code: string) {
  return withPublicLookup(async (tx) => {
    const chama = await tx.query.chamas.findFirst({ where: eq(chamas.slug, slug) });
    if (!chama) return null;
    await setTenantOnTx(tx, chama.id);
    const invite = code
      ? await tx.query.invites.findFirst({
          where: and(eq(invites.code, code), isNull(invites.usedAt)),
        })
      : null;
    const isJoinCode = code === chama.joinCode;
    const inviteValid = Boolean(invite && invite.expiresAt.getTime() > Date.now());
    return {
      chama: { id: chama.id, name: chama.name, slug: chama.slug, joinCode: chama.joinCode, status: chama.status },
      inviteRole: inviteValid && invite ? (invite.role as MemberRole) : null,
      valid: Boolean(isJoinCode || inviteValid),
    };
  });
}
