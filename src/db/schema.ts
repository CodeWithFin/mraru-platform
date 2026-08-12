import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const onboardingStateEnum = pgEnum("onboarding_state", [
  "started",
  "phone_verified",
  "chama_config_pending",
  "details_submitted",
  "kyc_pending",
  "kyc_in_review",
  "kyc_declined",
  "kyc_approved",
  "constitution_pending",
  "constitution_accepted",
  "awaiting_governance_approval",
  "active",
  "abandoned",
]);

export const chamaStatusEnum = pgEnum("chama_status", [
  "pending_setup",
  "active",
  "suspended",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "chairperson",
  "treasurer",
  "secretary",
  "member",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "pending_review",
  "active",
  "suspended",
  "exited",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "not_started",
  "pending_review",
  "in_review",
  "approved",
  "rejected",
  "abandoned",
  "expired",
]);

export const otpPurposeEnum = pgEnum("otp_purpose", [
  "signup",
  "login",
  "password_reset",
]);

// Chamas Table
export const chamas = pgTable("chamas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  county: text("county").notNull(),
  chamaType: text("chama_type").notNull(), // e.g. "Investment", "Merry-Go-Round", "Savings & Loans"
  votingModel: text("voting_model").notNull().default("equal_share"),
  status: chamaStatusEnum("status").notNull().default("pending_setup"),
  founderMemberId: text("founder_member_id"),
  lendingEnabled: boolean("lending_enabled").notNull().default(false),
  minContributionAmount: numeric("min_contribution_amount", { precision: 12, scale: 2 }),
  contributionDueDay: integer("contribution_due_day").default(1),
  penaltyRule: jsonb("penalty_rule"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Members Table
export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    chamaId: text("chama_id").references(() => chamas.id),
    fullName: text("full_name"),
    nationalIdEncrypted: text("national_id_encrypted"),
    phone: text("phone").notNull(),
    email: text("email"),
    nextOfKinName: text("next_of_kin_name"),
    nextOfKinPhone: text("next_of_kin_phone"),
    nextOfKinRelationship: text("next_of_kin_relationship"),
    role: memberRoleEnum("role").notNull().default("member"),
    isFounder: boolean("is_founder").notNull().default(false),
    onboardingState: onboardingStateEnum("onboarding_state")
      .notNull()
      .default("started"),
    status: memberStatusEnum("status").notNull().default("pending_review"),
    kycSessionId: text("kyc_session_id"),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("not_started"),
    kycDecisionSummary: jsonb("kyc_decision_summary"),
    profileImageUrl: text("profile_image_url"),
    passwordHash: text("password_hash"),
    resumeToken: text("resume_token"),
    resumeTokenExpiresAt: timestamp("resume_token_expires_at"),
    approvedByMemberId: text("approved_by_member_id"),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Phone unique per chama_id (composite unique constraint)
    chamaPhoneUnique: uniqueIndex("chama_phone_idx").on(table.chamaId, table.phone),
  })
);

// OTP Verifications Table
export const otpVerifications = pgTable("otp_verifications", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: otpPurposeEnum("purpose").notNull().default("signup"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Constitutions Table
export const constitutions = pgTable("constitutions", {
  id: text("id").primaryKey(),
  chamaId: text("chama_id")
    .notNull()
    .references(() => chamas.id),
  version: integer("version").notNull().default(1),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  createdByMemberId: text("created_by_member_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Constitution Acceptances Table
export const constitutionAcceptances = pgTable("constitution_acceptances", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  constitutionId: text("constitution_id")
    .notNull()
    .references(() => constitutions.id),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});

// Invites Table
export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  chamaId: text("chama_id")
    .notNull()
    .references(() => chamas.id),
  phone: text("phone").notNull(),
  role: memberRoleEnum("role").notNull().default("member"),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdByMemberId: text("created_by_member_id"),
});

// Audit Log Table
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  chamaId: text("chama_id"),
  actorMemberId: text("actor_member_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook Events Table
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull().default("didit"),
  eventId: text("event_id"),
  signatureValid: boolean("signature_valid").notNull(),
  rawPayload: jsonb("raw_payload"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
