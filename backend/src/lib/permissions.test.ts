import { describe, expect, it } from 'vitest';

import { chamaRolesSatisfied, isCoreRole, roleHasPermission } from './permissions.js';

describe('permissions matrix', () => {
  it('lets chairperson and secretary approve, but never a plain member', () => {
    expect(roleHasPermission('chairperson', 'member.approve')).toBe(true);
    expect(roleHasPermission('secretary', 'member.approve')).toBe(true);
    expect(roleHasPermission('treasurer', 'member.approve')).toBe(false);
    expect(roleHasPermission('member', 'member.approve')).toBe(false);
  });

  it('restricts constitution amendments to the chairperson', () => {
    expect(roleHasPermission('chairperson', 'constitution.create')).toBe(true);
    expect(roleHasPermission('secretary', 'constitution.create')).toBe(false);
  });

  it('exposes constitution view/accept to every role', () => {
    for (const role of ['chairperson', 'treasurer', 'secretary', 'member']) {
      expect(roleHasPermission(role, 'constitution.accept')).toBe(true);
    }
  });
});

describe('chama activation governance rule', () => {
  it('requires chairperson + treasurer + secretary', () => {
    expect(chamaRolesSatisfied(['chairperson'])).toBe(false);
    expect(chamaRolesSatisfied(['chairperson', 'treasurer'])).toBe(false);
    expect(chamaRolesSatisfied(['chairperson', 'treasurer', 'secretary'])).toBe(true);
    expect(chamaRolesSatisfied(['chairperson', 'treasurer', 'secretary', 'member'])).toBe(true);
  });

  it('identifies core roles', () => {
    expect(isCoreRole('chairperson')).toBe(true);
    expect(isCoreRole('member')).toBe(false);
  });
});
