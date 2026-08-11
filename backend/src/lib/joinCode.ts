import { randomInt } from 'node:crypto';

/** Alphabet without confusing characters (no 0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a short, human-friendly join code like `MRARU-4X9K`:
 * up to 5 letters derived from the chama slug + 4 random chars.
 */
export function generateJoinCode(slug: string): string {
  const prefix = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
  const random = Array.from({ length: 4 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('');
  return `${prefix || 'MRARU'}-${random}`;
}
