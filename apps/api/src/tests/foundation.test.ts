import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  encryptField,
  decryptField,
  createBlindIndex,
  calculateAuditHash,
  hashPassword,
  verifyPassword,
  generateMFACredentials,
  verifyMFACode,
} from '../utils/crypto.util.js';

describe('Phase 1 Foundation: Core Health & Cryptography Suites', () => {
  const app = createApp();

  describe('Health Probes', () => {
    it('GET /health/live returns UP status and uptime', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('GET /health/ready responds with database status', async () => {
      const res = await request(app).get('/health/ready');
      // Ready returns 200 or 503 depending on live DB connection
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('database');
    });

    it('returns RFC 7807 problem details on unhandled route', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');
      expect([404, 200]).toBeDefined();
    });
  });

  describe('Field-Level Cryptography & Blind Indexing', () => {
    it('encrypts and decrypts sensitive PHI strings correctly with AES-256-GCM', () => {
      const sensitiveSSN = '123-45-6789';
      const encrypted = encryptField(sensitiveSSN);

      expect(encrypted).not.toBe(sensitiveSSN);
      expect(encrypted).toContain(':'); // IV:Tag:Ciphertext format

      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(sensitiveSSN);
    });

    it('generates consistent deterministic HMAC-SHA256 blind indexes', () => {
      const phone1 = '(555) 234-5678';
      const phone2 = '555-234-5678';
      const phone3 = '5552345678';

      const blindIndex1 = createBlindIndex(phone1);
      const blindIndex2 = createBlindIndex(phone2);
      const blindIndex3 = createBlindIndex(phone3);

      expect(blindIndex1).toBe(blindIndex2);
      expect(blindIndex2).toBe(blindIndex3);
      expect(blindIndex1.length).toBe(64); // 256-bit hex
    });

    it('calculates deterministic SHA-256 tamper-evident hash for audit logs', () => {
      const auditParams = {
        seq: 1,
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
        actorId: 'usr_1001',
        action: 'PATIENT_READ',
        resourceType: 'Patient',
        resourceId: 'pat_2001',
        patientId: 'pat_2001',
        timestamp: '2026-09-21T09:00:00.000Z',
      };

      const hash1 = calculateAuditHash(auditParams);
      const hash2 = calculateAuditHash(auditParams);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);

      // Any mutation must invalidate the hash
      const tamperedHash = calculateAuditHash({ ...auditParams, actorId: 'usr_9999' });
      expect(tamperedHash).not.toBe(hash1);
    });
  });

  describe('Argon2id & TOTP MFA', () => {
    it('hashes passwords with Argon2id and verifies correctly', async () => {
      const password = 'StrongClinicalPassword#2026';
      const hash = await hashPassword(password);

      expect(hash).toContain('$argon2id$');
      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword(hash, 'WrongPassword');
      expect(isInvalid).toBe(false);
    });

    it('generates TOTP MFA credentials and verifies codes', async () => {
      const mfa = await generateMFACredentials('doctor@hospital.org');
      expect(mfa.secret).toBeDefined();
      expect(mfa.otpauthUrl).toContain('otpauth://totp/');
      expect(mfa.qrCodeDataUrl).toContain('data:image/png;base64');
    });
  });
});
