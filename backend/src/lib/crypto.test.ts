import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, redactNationalId } from './crypto.js';

describe('crypto (AES-256-GCM)', () => {
  it('round-trips a national ID', () => {
    const encrypted = encryptSecret('31245678');
    expect(encrypted).toMatch(/^v1:/);
    expect(decryptSecret(encrypted)).toBe('31245678');
  });

  it('produces unique ciphertexts for the same input', () => {
    expect(encryptSecret('123')).not.toBe(encryptSecret('123'));
  });

  it('fails on tampered payloads', () => {
    const encrypted = encryptSecret('123456');
    const tampered = encrypted.replace(/.$/, encrypted.endsWith('A') ? 'B' : 'A');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('redacts to last-4 digits', () => {
    expect(redactNationalId('31245678')).toBe('NC-••••5678');
    // Short IDs reveal whatever digits exist — never the encrypted blob.
    expect(redactNationalId('12')).toBe('NC-••••12');
    expect(redactNationalId('abc')).toBe('NC-••••');
  });
});
