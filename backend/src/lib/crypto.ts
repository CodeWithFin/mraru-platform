import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../env.js';

const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');

export interface EncryptedSecret {
  /** Encoded payload: v1:<iv b64>:<authTag b64>:<ciphertext b64> */
  value: string;
}

/**
 * Encrypt a secret (national ID) at rest with AES-256-GCM.
 * The 12-byte IV and 16-byte auth tag travel with the ciphertext.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypt a value produced by {@link encryptSecret}. Throws on tampering. */
export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Unsupported or malformed encrypted payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * Redact a national ID for API responses: show only the last 4 digits.
 * Never reveal the encrypted value or plaintext outside the owning member
 * and the chairperson.
 */
export function redactNationalId(plaintext: string): string {
  const digits = plaintext.replace(/\D/g, '');
  const tail = digits.slice(-4);
  return tail ? `NC-••••${tail}` : 'NC-••••';
}
