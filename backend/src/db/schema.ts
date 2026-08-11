import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Enum-like union types (stored as text + CHECK constraints)          */
/* ------------------------------------------------------------------ */

export const chamaStatuses = ['pending_setup', 'active', 'suspended'] as const;
export type ChamaStatus = (typeof chamaStatuses)[number];

export const chamaTypes = ['investment_group', 'sacco', 'hybrid'] as const;
export type ChamaType = (typeof chamaTypes)[number];

export const votingModels = ['one_member_one_vote', 'shareholding_weighted'] as const;
export type VotingModel = (typeof votingModels)[number];

export const memberRoles = ['chairperson', 'treasurer', 'secretary', 'member'] as const;
export type MemberRole = (typeof memberRoles)[number];

export const memberStatuses = ['pending_review', 'active', 'suspended', 'exited', 'rejected'] as const;
export type MemberStatus = (typeof memberStatuses)[number];

export const kycStatuses = ['pending', 'approved', 'rejected'] as const;
export type KycStatus = (typeof kycStatuses)[number];

export const otpPurposes = ['signup', 'login', 'password_reset'] as const;
export type OtpPurpose = (typeof otpPurposes)[number];

export const inviteKinds = ['invite_link', 'join_code'] as const;
export type InviteKind = (typeof inviteKinds)[number];

export const kycDocKinds = ['national_id_front', 'national_id_back', 'passport_photo'] as const;
export type KycDocKind = (typeof kycDocKinds)[number];

/* ------------------------------------------------------------------ */
/* RLS helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Predicate used by every chama-scoped RLS policy: the row's chama_id must
 * match the session claim set by the API (`SET LOCAL app.chama_id = ...`
 * inside a transaction). `current_setting(..., true)` returns NULL when
 * unset, which makes the comparison NULL and denies the row — safe default.
 */
const tenantMatches = sql`current_setting('app.chama_id', true)::uuid`;

/**
 * Allows a SELECT when the API explicitly opts into a public lookup
 * (e.g. join-by-code / invite lookups before the caller is a member) by
 * setting `app.public_lookup = 'true'` for the transaction.
 */
const publicLookup = sql`current_setting('app.public_lookup', true) = 'true'`;

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export const chamas = pgTable(
  'chamas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    joinCode: text('join_code').notNull(),
    county: text('county'),
    chamaType: text('chama_type', { enum: chamaTypes }).notNull(),
    votingModel: text('voting_model', { enum: votingModels }).notNull(),
    status: text('status', { enum: chamaStatuses }).notNull().default('pending_setup'),
    lendingEnabled: boolean('lending_enabled').notNull().default(false),
    founderMemberId: uuid('founder_member_id'),
    foundingDate: date('founding_date', { mode: 'string' }),
    expectedMembersMin: integer('expected_members_min'),
    expectedMembersMax: integer('expected_members_max'),
    minimumContribution: numeric('minimum_contribution', { precision: 12, scale: 2 }).notNull().default('0'),
    contributionDueDay: integer('contribution_due_day'),
    penaltyRule: jsonb('penalty_rule'),
    createdByMemberId: uuid('created_by_member_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('chamas_slug_unique').on(table.slug),
    uniqueIndex('chamas_join_code_unique').on(table.joinCode),
    index('chamas_status_idx').on(table.status),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.id} = ${tenantMatches}`,
      withCheck: sql`${table.id} = ${tenantMatches}`,
    }),
    // Join-by-code and invite lookups happen before the caller is a member;
    // the API sets app.public_lookup inside the join transaction only.
    pgPolicy('public_join_lookup', {
      as: 'permissive',
      for: 'select',
      using: publicLookup,
    }),
    // Slug / join-code uniqueness checks need to see every tenant; the API sets
    // app.global_lookup inside those short transactions only.
    pgPolicy('global_lookup', {
      as: 'permissive',
      for: 'select',
      using: sql`current_setting('app.global_lookup', true) = 'true'`,
    }),
    check('chamas_status_check', sql`${table.status} in ('pending_setup', 'active', 'suspended')`),
    check('chamas_type_check', sql`${table.chamaType} in ('investment_group', 'sacco', 'hybrid')`),
    check('chamas_voting_check', sql`${table.votingModel} in ('one_member_one_vote', 'shareholding_weighted')`),
    check('chamas_due_day_check', sql`${table.contributionDueDay} is null or ${table.contributionDueDay} between 1 and 28`),
  ],
);

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    nationalIdEncrypted: text('national_id_encrypted').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    nextOfKinName: text('next_of_kin_name'),
    nextOfKinPhone: text('next_of_kin_phone'),
    nextOfKinRelationship: text('next_of_kin_relationship'),
    role: text('role', { enum: memberRoles }).notNull().default('member'),
    isFounder: boolean('is_founder').notNull().default(false),
    status: text('status', { enum: memberStatuses }).notNull().default('pending_review'),
    kycStatus: text('kyc_status', { enum: kycStatuses }).notNull().default('pending'),
    passwordHash: text('password_hash'),
    approvedByMemberId: uuid('approved_by_member_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    rejectionReason: text('rejection_reason'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('members_phone_per_chama_unique').on(table.chamaId, table.phone),
    index('members_chama_status_idx').on(table.chamaId, table.status),
    index('members_chama_role_idx').on(table.chamaId, table.role),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.chamaId} = ${tenantMatches}`,
      withCheck: sql`${table.chamaId} = ${tenantMatches}`,
    }),
    check('members_role_check', sql`${table.role} in ('chairperson', 'treasurer', 'secretary', 'member')`),
    check('members_status_check', sql`${table.status} in ('pending_review', 'active', 'suspended', 'exited', 'rejected')`),
    check('members_kyc_check', sql`${table.kycStatus} in ('pending', 'approved', 'rejected')`),
  ],
);

/**
 * Tenant-agnostic credential lookup table used ONLY by login/password-reset
 * flows (a phone may belong to memberships in several chamas). Members rows
 * themselves are RLS-scoped, so resolving phone -> (memberId, chamaId) needs
 * a table outside the tenant envelope. Password hashes stay on `members`.
 */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    chamaId: uuid('chama_id').notNull(),
    memberId: uuid('member_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_identities_phone_chama_unique').on(table.phone, table.chamaId),
    index('auth_identities_phone_idx').on(table.phone),
  ],
);

export const otpVerifications = pgTable(
  'otp_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: text('purpose', { enum: otpPurposes }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('otp_phone_purpose_idx').on(table.phone, table.purpose, table.createdAt),
  ],
);

export const constitutions = pgTable(
  'constitutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    fileUrl: text('file_url'),
    createdByMemberId: uuid('created_by_member_id')
      .notNull()
      .references(() => members.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('constitutions_chama_version_unique').on(table.chamaId, table.version),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.chamaId} = ${tenantMatches}`,
      withCheck: sql`${table.chamaId} = ${tenantMatches}`,
    }),
  ],
);

export const constitutionAcceptances = pgTable(
  'constitution_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    constitutionId: uuid('constitution_id')
      .notNull()
      .references(() => constitutions.id, { onDelete: 'cascade' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('acceptances_member_constitution_unique').on(table.memberId, table.constitutionId),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.memberId} in (select m.id from members m where m.chama_id = ${tenantMatches})`,
      withCheck: sql`${table.memberId} in (select m.id from members m where m.chama_id = ${tenantMatches})`,
    }),
  ],
);

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    role: text('role', { enum: memberRoles }).notNull(),
    kind: text('kind', { enum: inviteKinds }).notNull().default('invite_link'),
    code: text('code').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdByMemberId: uuid('created_by_member_id')
      .notNull()
      .references(() => members.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invites_code_unique').on(table.code),
    index('invites_chama_idx').on(table.chamaId),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.chamaId} = ${tenantMatches}`,
      withCheck: sql`${table.chamaId} = ${tenantMatches}`,
    }),
    pgPolicy('public_invite_lookup', {
      as: 'permissive',
      for: 'select',
      using: publicLookup,
    }),
  ],
);

export const kycDocuments = pgTable(
  'kyc_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: kycDocKinds }).notNull(),
    fileUrl: text('file_url').notNull(),
    mimeType: text('mime_type'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('kyc_member_idx').on(table.memberId),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.chamaId} = ${tenantMatches}`,
      withCheck: sql`${table.chamaId} = ${tenantMatches}`,
    }),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    /** Denormalised so refresh can re-enter the tenant envelope to load the member. */
    chamaId: uuid('chama_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('refresh_member_idx').on(table.memberId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chamaId: uuid('chama_id')
      .notNull()
      .references(() => chamas.id, { onDelete: 'cascade' }),
    actorMemberId: uuid('actor_member_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_chama_idx').on(table.chamaId, table.createdAt),
    pgPolicy('tenant_isolation', {
      as: 'permissive',
      for: 'all',
      using: sql`${table.chamaId} = ${tenantMatches}`,
      withCheck: sql`${table.chamaId} = ${tenantMatches}`,
    }),
  ],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const chamasRelations = relations(chamas, ({ many, one }) => ({
  founder: one(members, { fields: [chamas.founderMemberId], references: [members.id] }),
  members: many(members),
  constitutions: many(constitutions),
  invites: many(invites),
  auditEntries: many(auditLog),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  chama: one(chamas, { fields: [members.chamaId], references: [chamas.id] }),
  kycDocuments: many(kycDocuments),
  acceptances: many(constitutionAcceptances),
}));

export const constitutionsRelations = relations(constitutions, ({ one, many }) => ({
  chama: one(chamas, { fields: [constitutions.chamaId], references: [chamas.id] }),
  createdBy: one(members, { fields: [constitutions.createdByMemberId], references: [members.id] }),
  acceptances: many(constitutionAcceptances),
}));

export const constitutionAcceptancesRelations = relations(constitutionAcceptances, ({ one }) => ({
  member: one(members, { fields: [constitutionAcceptances.memberId], references: [members.id] }),
  constitution: one(constitutions, {
    fields: [constitutionAcceptances.constitutionId],
    references: [constitutions.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  chama: one(chamas, { fields: [invites.chamaId], references: [chamas.id] }),
  createdBy: one(members, { fields: [invites.createdByMemberId], references: [members.id] }),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  chama: one(chamas, { fields: [kycDocuments.chamaId], references: [chamas.id] }),
  member: one(members, { fields: [kycDocuments.memberId], references: [members.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  member: one(members, { fields: [refreshTokens.memberId], references: [members.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  chama: one(chamas, { fields: [auditLog.chamaId], references: [chamas.id] }),
  actor: one(members, { fields: [auditLog.actorMemberId], references: [members.id] }),
}));
