import type { MemberRole, MemberStatus } from '../db/schema.js';

export const PERMISSIONS = {
  'member.view': ['chairperson', 'secretary', 'treasurer'],
  'member.approve': ['chairperson', 'secretary'],
  'member.reject': ['chairperson', 'secretary'],
  'member.invite': ['chairperson', 'secretary'],
  'member.role.assign': ['chairperson'],
  'kyc.review': ['chairperson', 'secretary'],
  'constitution.create': ['chairperson'],
  'constitution.view': ['chairperson', 'treasurer', 'secretary', 'member'],
  'constitution.accept': ['chairperson', 'treasurer', 'secretary', 'member'],
  'chama.update': ['chairperson'],
  'invite.list': ['chairperson'],
  'audit.view': ['chairperson', 'secretary', 'treasurer'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Server-side role gate: the JWT role claim is checked against the matrix —
 * the frontend route guards are cosmetic only.
 */
export function roleHasPermission(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

/**
 * A member's *status* can override what they may do regardless of role:
 *  - pending_review members get limited read-only access (view/accept the
 *    constitution, upload their own KYC) but nothing else.
 *  - suspended/exited/rejected members get nothing.
 */
export const STATUS_ALLOWED_ANY = new Set<MemberStatus>(['pending_review', 'active', 'suspended']);
export const STATUS_ALLOWED_ACTIVE = new Set<MemberStatus>(['active']);

export function isStatusAllowed(status: MemberStatus, activeOnly: boolean): boolean {
  return activeOnly ? STATUS_ALLOWED_ACTIVE.has(status) : STATUS_ALLOWED_ANY.has(status);
}

/**
 * Governance safeguard: a chama can only be `active` once the Chairperson,
 * Treasurer **and** Secretary roles are all assigned to active members.
 * Enforced server-side on every approval / role change / invite acceptance.
 */
export function chamaRolesSatisfied(roles: string[]): boolean {
  const set = new Set(roles);
  return set.has('chairperson') && set.has('treasurer') && set.has('secretary');
}

export function isCoreRole(role: MemberRole): boolean {
  return role === 'chairperson' || role === 'treasurer' || role === 'secretary';
}
