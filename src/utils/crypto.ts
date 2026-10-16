import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Authenticated encryption for secrets we must store (e.g. Google refresh
 * tokens). AES-256-GCM with a random 96-bit IV per value.
 *
 * Format: `v1.<iv>.<authTag>.<ciphertext>` (base64url parts). The version
 * prefix lets us rotate the scheme later without guessing.
 *
 * `context` is bound as Additional Authenticated Data — pass the owning row's
 * userId so a ciphertext copied onto another user's row fails to decrypt.
 */

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;

export class EncryptionKeyError extends Error {}

/** 32-byte key from TOKEN_ENCRYPTION_KEY (base64). Throws if missing/wrong size. */
export function getEncryptionKey (): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (raw === undefined || raw === '') {
    throw new EncryptionKeyError('TOKEN_ENCRYPTION_KEY is not configured');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new EncryptionKeyError('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)');
  }
  return key;
}

export function encryptSecret (plaintext: string, context: string, key: Buffer = getEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/** Throws if the value was tampered with, encrypted for another context, or under another key. */
export function decryptSecret (payload: string, context: string, key: Buffer = getEncryptionKey()): string {
  const [version, ivB64, tagB64, dataB64, ...rest] = payload.split('.');
  if (version !== VERSION || ivB64 === undefined || tagB64 === undefined || dataB64 === undefined || rest.length > 0) {
    throw new Error('Unsupported encrypted payload format');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}
