import { describe, expect, it } from 'vitest';

import { buildChamaSlug, slugify, uniqueSlug } from './slug.js';
import { generateJoinCode } from './joinCode.js';

describe('slugs', () => {
  it('builds name+county slugs', () => {
    expect(buildChamaSlug('Mraru', 'Nairobi')).toBe('mraru-nairobi');
    expect(buildChamaSlug('Kijani Investments', null)).toBe('kijani-investments');
  });

  it('slugs normalise case and punctuation', () => {
    expect(slugify('  Wema! Trust & Co.  ')).toBe('wema-trust-co');
  });

  it('appends numeric suffixes when the base is taken', async () => {
    const taken = new Set(['mraru-nairobi']);
    const result = await uniqueSlug('mraru-nairobi', async (s) => taken.has(s));
    expect(result).toBe('mraru-nairobi-2');
  });
});

describe('join codes', () => {
  it('generates MRARU-XXXX format from the slug', () => {
    const code = generateJoinCode('mraru-nairobi');
    expect(code).toMatch(/^MRARU-[A-Z2-9]{4}$/);
  });

  it('produces varying codes', () => {
    expect(generateJoinCode('mraru-nairobi')).not.toBe(generateJoinCode('mraru-nairobi'));
  });
});
