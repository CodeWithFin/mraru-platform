import { z } from 'zod';

import { chamaTypes, memberRoles, otpPurposes, votingModels } from '../db/schema.js';
import { MIN_PASSWORD_LENGTH } from './password.js';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{9,15}$/, 'Enter a valid phone number (e.g. +2547XXXXXXXX)');

export const uuidSchema = z.string().uuid();

export const nationalIdSchema = z.string().trim().min(5, 'National ID is too short').max(20, 'National ID is too long');

const penaltyRuleSchema = z
  .union([
    z.object({ type: z.literal('flat'), amount: z.number().positive('Penalty amount must be positive') }),
    z.object({
      type: z.literal('percent_per_day'),
      rate: z.number().min(0, 'Rate cannot be negative').max(1, 'Rate must be between 0 and 1'),
    }),
  ])
  .nullable()
  .optional();

/* ------------------------------- Auth ------------------------------- */

export const otpSendSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(otpPurposes),
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  purpose: z.enum(otpPurposes),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(200),
  /** Required only when the phone belongs to memberships in multiple chamas. */
  chamaId: uuidSchema.optional(),
});

export const loginOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/),
  chamaId: uuidSchema.optional(),
});

export const passwordResetRequestSchema = z.object({ phone: phoneSchema });

export const passwordResetConfirmSchema = z.object({
  phone: phoneSchema,
  grant: z.string().min(10),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(128),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

/* ---------------------------- Chama (Path A) ------------------------- */

export const createChamaSchema = z.object({
  chama: z.object({
    name: z.string().trim().min(2, 'Chama name is required').max(100),
    county: z.string().trim().min(2).max(60).nullable().optional(),
    chamaType: z.enum(chamaTypes),
    votingModel: z.enum(votingModels),
    foundingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    expectedMembersMin: z.number().int().min(1).max(1_000_000).nullable().optional(),
    expectedMembersMax: z.number().int().min(1).max(1_000_000).nullable().optional(),
    minimumContribution: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount'),
    contributionDueDay: z.number().int().min(1).max(28).nullable().optional(),
    penaltyRule: penaltyRuleSchema,
    lendingEnabled: z.boolean().default(false),
  }),
  founder: z.object({
    fullName: z.string().trim().min(2, 'Full name is required').max(120),
    nationalId: nationalIdSchema,
    phone: phoneSchema,
    email: z.string().email('Enter a valid email').max(120).nullable().optional(),
  }),
  otpGrant: z.string().min(10),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(128),
  constitution: z.object({
    mode: z.enum(['template', 'upload']),
    content: z.string().max(200_000).nullable().optional(),
    fileUrl: z.string().max(600).nullable().optional(),
    accepted: z.literal(true, { error: 'You must accept the constitution' }),
  }),
});

/* ----------------------------- Join (Path B) ------------------------- */

export const joinChamaSchema = z.object({
  code: z.string().trim().min(4, 'Enter the chama join code or invite link code').max(100),
  phone: phoneSchema,
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  nationalId: nationalIdSchema,
  email: z.string().email('Enter a valid email').max(120).nullable().optional(),
  nextOfKin: z.object({
    name: z.string().trim().min(2, 'Next of kin name is required').max(120),
    phone: phoneSchema,
    relationship: z.string().trim().min(2, 'Relationship is required').max(60),
  }),
  otpGrant: z.string().min(10),
});

/* ------------------------------- Members ----------------------------- */

export const rejectMemberSchema = z.object({
  reason: z.string().trim().min(3, 'A reason is required when rejecting an application').max(500),
});

export const approveMemberSchema = z.object({}).optional();

/* --------------------------- Constitutions --------------------------- */

export const constitutionAcceptSchema = z.object({});

export const constitutionAmendSchema = z
  .object({
    content: z.string().trim().min(20).max(200_000).nullable().optional(),
    fileUrl: z.string().max(600).nullable().optional(),
  })
  .refine((v) => v.content || v.fileUrl, { message: 'Provide content or an uploaded file' });

/* ------------------------------- Invites ----------------------------- */

export const inviteCreateSchema = z.object({
  phone: phoneSchema,
  role: z.enum(['member', 'treasurer', 'secretary']),
});
