import crypto from 'crypto';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive PHI field using AES-256-GCM
 */
export function encryptField(plainText: string): string {
  if (!plainText) return plainText;
  const key = Buffer.from(env.FIELD_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive PHI field using AES-256-GCM
 */
export function decryptField(cipherPayload: string): string {
  if (!cipherPayload || !cipherPayload.includes(':')) return cipherPayload;
  try {
    const [ivHex, tagHex, encryptedHex] = cipherPayload.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return cipherPayload;

    const key = Buffer.from(env.FIELD_ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails (e.g. unencrypted legacy or key mismatch), return safe placeholder or raw
    return cipherPayload;
  }
}

/**
 * Deterministic HMAC-SHA256 Blind Index for exact match searches on encrypted fields
 */
export function createBlindIndex(value: string): string {
  if (!value) return '';
  let normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  // Normalize 11-digit phone starting with 1 to 10-digit
  if (normalized.length === 11 && normalized.startsWith('1')) {
    normalized = normalized.substring(1);
  }
  return crypto.createHmac('sha256', env.BLIND_INDEX_SALT).update(normalized).digest('hex');
}

/**
 * SHA-256 Tamper-Evident Hash Chain computation for Audit Logs
 */
export function calculateAuditHash(params: {
  seq: number;
  prevHash: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  timestamp: string;
  diff?: unknown;
}): string {
  const content = JSON.stringify({
    seq: params.seq,
    prevHash: params.prevHash,
    actorId: params.actorId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId || null,
    patientId: params.patientId || null,
    timestamp: params.timestamp,
    diff: params.diff || null,
  });

  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Argon2id password hashing
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Argon2id password verification
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Generate TOTP MFA secret and QR code
 */
export async function generateMFACredentials(email: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, env.MFA_ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

/**
 * Verify TOTP MFA Token
 */
export function verifyMFACode(code: string, secret: string): boolean {
  return authenticator.check(code, secret);
}
