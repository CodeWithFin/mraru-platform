import { randomUUID } from 'node:crypto';

import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { setTenantOnTx, withGlobalLookup, withPublicLookup, withTenant } from '../db/client.js';
import {
  authIdentities,
  chamas,
  constitutionAcceptances,
  constitutions,
  invites,
  members,
  type ChamaType,
  type MemberRole,
  type VotingModel,
} from '../db/schema.js';
import { writeAudit } from '../lib/audit.js';
import { generateDefaultConstitution } from '../lib/constitution.js';
import { encryptSecret } from '../lib/crypto.js';
import { HttpError } from '../lib/errors.js';
import { generateJoinCode } from '../lib/joinCode.js';
import { hashPassword } from '../lib/password.js';
import { buildChamaSlug, uniqueSlug } from '../lib/slug.js';
import { assertOtpGrantValid } from './otp.service.js';
import { enqueueSms } from './queue.js';
import { issueTokens, type IssuedTokens } from './session.js';

/* ------------------------------------------------------------------ */
/* Path A — create a chama + founder account                           */
/* ------------------------------------------------------------------ */

export interface CreateChamaInput {
  chama: {
    name: string;
    county?: string | null;
    chamaType: ChamaType;
    votingModel: VotingModel;
    foundingDate?: string | null;
    expectedMembersMin?: number | null;
    expectedMembersMax?: number | null;
    minimumContribution: string;
    contributionDueDay?: number | null;
    penaltyRule?: { type: 'flat'; amount: number } | { type: 'percent_per_day'; rate: number } | null;
    lendingEnabled: boolean;
  };
  founder: { fullName: string; nationalId: string; phone: string; email?: string | null };
  otpGrant: string;
  password: string;
  constitution: {
    mode: 'template' | 'upload';
    content?: string | null;
    fileUrl?: string | null;
    accepted: true;
  };
}

export interface CreateChamaResult {
  chama: { id: string; name: string; slug: string; joinCode: string; status: string };
  member: { id: string; role: MemberRole };
  tokens: IssuedTokens;
}

export async function createChamaAndFounder(input: CreateChamaInput): Promise<CreateChamaResult> {
  const { chama, founder, otpGrant, password, constitution } = input;

  await assertOtpGrantValid(otpGrant, { purpose: 'signup', phone: founder.phone });

  const passwordHash = await hashPassword(password);
  const nationalIdEncrypted = encryptSecret(founder.nationalId);
  const chamaId = randomUUID();

  // Slug + join code are globally unique — checked under the global-lookup
  // RLS flag so the uniqueness query can see every tenant.
  const { slug, joinCode } = await withGlobalLookup(async (tx) => {
    const base = buildChamaSlug(chama.name, chama.county);
    const s = await uniqueSlug(base, async (candidate) => {
      const hit = await tx.select({ id: chamas.id }).from(chamas).where(eq(chamas.slug, candidate)).limit(1);
      return Boolean(hit[0]);
    });
    let jc = generateJoinCode(s);
    for (let i = 0; i < 20; i++) {
      const hit = await tx.select({ id: chamas.id }).from(chamas).where(eq(chamas.joinCode, jc)).limit(1);
      if (!hit[0]) break;
      jc = generateJoinCode(s);
    }
    return { slug: s, joinCode: jc };
  });

  const content =
    constitution.mode === 'upload' && constitution.fileUrl
      ? 'Constitution provided as an uploaded document — see attached file.'
      : constitution.content?.trim() ||
        generateDefaultConstitution({
          chamaName: chama.name,
          county: chama.county,
          chamaType: chama.chamaType,
          votingModel: chama.votingModel,
          minimumContribution: chama.minimumContribution,
          contributionDueDay: chama.contributionDueDay,
          penaltyRule: chama.penaltyRule,
          lendingEnabled: chama.lendingEnabled,
        });

  const created = await withTenant(chamaId, async (tx) => {
    const [chamaRow] = (await tx
      .insert(chamas)
      .values({
        id: chamaId,
        name: chama.name,
        slug,
        joinCode,
        county: chama.county ?? null,
        chamaType: chama.chamaType,
        votingModel: chama.votingModel,
        status: 'pending_setup',
        lendingEnabled: chama.lendingEnabled,
        foundingDate: chama.foundingDate ?? null,
        expectedMembersMin: chama.expectedMembersMin ?? null,
        expectedMembersMax: chama.expectedMembersMax ?? null,
        minimumContribution: chama.minimumContribution,
        contributionDueDay: chama.contributionDueDay ?? null,
        penaltyRule: chama.penaltyRule ?? null,
      })
      .returning()) as [typeof chamas.$inferSelect];

    const [memberRow] = (await tx
      .insert(members)
      .values({
        chamaId,
        fullName: founder.fullName,
        nationalIdEncrypted,
        phone: founder.phone,
        email: founder.email ?? null,
        role: 'chairperson',
        isFounder: true,
        status: 'active',
        kycStatus: 'pending',
        passwordHash,
      })
      .returning()) as [typeof members.$inferSelect];

    await tx.insert(authIdentities).values({ phone: founder.phone, chamaId, memberId: memberRow.id });

    await tx
      .update(chamas)
      .set({ founderMemberId: memberRow.id, createdByMemberId: memberRow.id, updatedAt: new Date() })
      .where(eq(chamas.id, chamaId));

    const [constitutionRow] = (await tx
      .insert(constitutions)
      .values({
        chamaId,
        version: 1,
        content,
        fileUrl: constitution.mode === 'upload' ? (constitution.fileUrl ?? null) : null,
        createdByMemberId: memberRow.id,
      })
      .returning()) as [typeof constitutions.$inferSelect];

    // The founder must have digitally accepted the constitution before the
    // chama is created — this is the activation precondition.
    if (!constitution.accepted) {
      throw HttpError.badRequest('You must accept the constitution to create the chama');
    }
    await tx.insert(constitutionAcceptances).values({ memberId: memberRow.id, constitutionId: constitutionRow.id });

    await writeAudit(tx, {
      chamaId,
      actorMemberId: memberRow.id,
      action: 'chama.created',
      entityType: 'chama',
      entityId: chamaId,
      afterState: { name: chama.name, slug, status: 'pending_setup' },
    });
    await writeAudit(tx, {
      chamaId,
      actorMemberId: memberRow.id,
      action: 'member.created',
      entityType: 'member',
      entityId: memberRow.id,
      afterState: { role: 'chairperson', isFounder: true, status: 'active' },
    });
    await writeAudit(tx, {
      chamaId,
      actorMemberId: memberRow.id,
      action: 'constitution.created',
      entityType: 'constitution',
      entityId: constitutionRow.id,
      afterState: { version: 1 },
    });
    await writeAudit(tx, {
      chamaId,
      actorMemberId: memberRow.id,
      action: 'constitution.accepted',
      entityType: 'constitution',
      entityId: constitutionRow.id,
    });

    return { chamaRow, memberRow };
  });

  const tokens = await issueTokens({
    id: created.memberRow.id,
    chamaId,
    role: 'chairperson',
    status: 'active',
    isFounder: true,
    chamaSlug: slug,
  });

  await enqueueSms({
    to: founder.phone,
    text: `Welcome to ${chama.name} on Mraru! Your chama is created. Invite your Treasurer and Secretary to activate it.`,
  });

  return {
    chama: { id: chamaId, name: chama.name, slug, joinCode, status: 'pending_setup' },
    member: { id: created.memberRow.id, role: 'chairperson' },
    tokens,
  };
}

/* ------------------------------------------------------------------ */
/* Path B — join an existing chama                                     */
/* ------------------------------------------------------------------ */

export interface JoinChamaInput {
  slug: string;
  code: string;
  phone: string;
  fullName: string;
  nationalId: string;
  email?: string | null;
  nextOfKin: { name: string; phone: string; relationship: string };
  otpGrant: string;
}

export interface JoinChamaResult {
  memberId: string;
  status: string;
  role: MemberRole;
  invitedRole: MemberRole | null;
  chama: { id: string; name: string; slug: string; status: string };
  tokens: IssuedTokens;
}

export async function joinChama(input: JoinChamaInput): Promise<JoinChamaResult> {
  const { slug, code, phone, fullName, nationalId, email, nextOfKin, otpGrant } = input;

  await assertOtpGrantValid(otpGrant, { purpose: 'signup', phone });
  const nationalIdEncrypted = encryptSecret(nationalId);

  const joined = await withPublicLookup(async (tx) => {
    const chamaRow = await tx.query.chamas.findFirst({ where: eq(chamas.slug, slug) });
    if (!chamaRow) throw HttpError.notFound('Chama not found');

    await setTenantOnTx(tx, chamaRow.id);

    let role: MemberRole = 'member';
    let inviteRow: (typeof invites.$inferSelect) | null = null;

    if (code) {
      const invite = await tx.query.invites.findFirst({
        where: and(eq(invites.code, code), isNull(invites.usedAt), gt(invites.expiresAt, new Date())),
      });
      if (invite) {
        role = invite.role;
        inviteRow = invite;
      } else if (code !== chamaRow.joinCode) {
        throw HttpError.badRequest('Invalid join code or invite link');
      }
    }

    const existing = await tx.query.members.findFirst({
      where: and(eq(members.chamaId, chamaRow.id), eq(members.phone, phone)),
    });
    if (existing) {
      if (existing.status === 'rejected') {
        throw HttpError.conflict('This phone number was previously rejected. Please contact the Chairperson.');
      }
      throw HttpError.conflict('This phone number has already joined this chama');
    }

    const [memberRow] = (await tx
      .insert(members)
      .values({
        chamaId: chamaRow.id,
        fullName,
        nationalIdEncrypted,
        phone,
        email: email ?? null,
        nextOfKinName: nextOfKin.name,
        nextOfKinPhone: nextOfKin.phone,
        nextOfKinRelationship: nextOfKin.relationship,
        role,
        status: 'pending_review',
        kycStatus: 'pending',
      })
      .returning()) as [typeof members.$inferSelect];

    await tx.insert(authIdentities).values({ phone, chamaId: chamaRow.id, memberId: memberRow.id });

    if (inviteRow) {
      await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, inviteRow.id));
      await writeAudit(tx, {
        chamaId: chamaRow.id,
        action: 'member.joined_via_invite',
        entityType: 'member',
        entityId: memberRow.id,
        afterState: { role, inviteId: inviteRow.id },
      });
    } else {
      await writeAudit(tx, {
        chamaId: chamaRow.id,
        action: 'member.joined_via_code',
        entityType: 'member',
        entityId: memberRow.id,
        afterState: { role: 'member' },
      });
    }

    return { memberRow, chamaRow, role, inviteRow };
  });

  // A role pre-set by an invite link still requires chairperson/secretary
  // approval before it grants any permissions — never granted by the link alone.
  const tokens = await issueTokens({
    id: joined.memberRow.id,
    chamaId: joined.chamaRow.id,
    role: joined.role,
    status: 'pending_review',
    isFounder: false,
    chamaSlug: joined.chamaRow.slug,
  });

  return {
    memberId: joined.memberRow.id,
    status: 'pending_review',
    role: joined.role,
    invitedRole: joined.inviteRow ? joined.role : null,
    chama: {
      id: joined.chamaRow.id,
      name: joined.chamaRow.name,
      slug: joined.chamaRow.slug,
      status: joined.chamaRow.status,
    },
    tokens,
  };
}
