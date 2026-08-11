import { describe, expect, it } from 'vitest';

import { generateOtpCode, hashOtpCode, verifyOtpHash } from './otp.js';

describe('otp', () => {
  it('generates 6-digit zero-padded codes', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it('hashes codes with a random salt', () => {
    const a = hashOtpCode('123456');
    const b = hashOtpCode('123456');
    expect(a).toMatch(/^sha256:/);
    expect(a).not.toBe(b);
  });

  it('verifies correct codes and rejects wrong ones', () => {
    const stored = hashOtpCode('654321');
    expect(verifyOtpHash('654321', stored)).toBe(true);
    expect(verifyOtpHash('111111', stored)).toBe(false);
  });
});
