import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { AuditLogModel } from '../modules/audit/auditLog.model.js';
import { RefreshTokenModel } from '../modules/auth/refreshToken.model.js';
import { RoleController } from '../modules/roles/role.controller.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { hashPassword } from '../utils/crypto.util.js';
import { SYSTEM_ROLES, PERMISSIONS } from '@ehr/shared';

describe('Phase 2 Integration: Auth, RBAC Matrix, Token Reuse & Tamper-Evident Audit', () => {
  const app = createApp();
  let adminToken: string;
  let physicianToken: string;
  let receptionistToken: string;

  let adminRoleId: string;
  let physicianRoleId: string;
  let receptionistRoleId: string;
  const mockFacilityId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await connectDB();
    await UserModel.deleteMany({});
    await RoleModel.deleteMany({});
    await AuditLogModel.deleteMany({});
    await RefreshTokenModel.deleteMany({});

    // Seed default roles
    await RoleController.ensureDefaultRoles();

    const adminRole = await RoleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });
    const physicianRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHYSICIAN });
    const receptionistRole = await RoleModel.findOne({ name: SYSTEM_ROLES.RECEPTIONIST });

    adminRoleId = adminRole!._id.toString();
    physicianRoleId = physicianRole!._id.toString();
    receptionistRoleId = receptionistRole!._id.toString();

    const passwordHash = await hashPassword('Password123!@#');

    // Create Admin User
    await UserModel.create({
      email: 'admin@test.org',
      passwordHash,
      name: { given: ['Super'], family: 'Admin' },
      roleIds: [adminRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });

    // Create Physician User
    await UserModel.create({
      email: 'doctor@test.org',
      passwordHash,
      name: { given: ['Gregory'], family: 'House' },
      roleIds: [physicianRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });

    // Create Receptionist User
    await UserModel.create({
      email: 'reception@test.org',
      passwordHash,
      name: { given: ['Pam'], family: 'Beesly' },
      roleIds: [receptionistRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Authentication Lifecycle & Lockout Policy', () => {
    it('POST /auth/login fails on incorrect password and increments lockout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@test.org', password: 'WrongPassword123' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');

      const user = await UserModel.findOne({ email: 'doctor@test.org' });
      expect(user?.lockout.count).toBe(1);
    });

    it('POST /auth/login logs in successfully and returns JWT + Refresh cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.org', password: 'Password123!@#' });

      expect(res.status).toBe(200);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@test.org');
      expect(res.body.data.user.roles).toContain(SYSTEM_ROLES.SUPER_ADMIN);

      adminToken = res.body.data.accessToken;
      expect(adminToken).toBeDefined();

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
    });

    it('enforces lockout policy after 5 failed attempts', async () => {
      // Trigger 4 more failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'doctor@test.org', password: 'WrongPassword' });
      }

      const lockedUser = await UserModel.findOne({ email: 'doctor@test.org' });
      expect(lockedUser?.lockout.count).toBe(5);
      expect(lockedUser?.lockout.until).toBeDefined();

      // Now even correct password should be rejected with 403 Forbidden due to lockout
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@test.org', password: 'Password123!@#' });

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('Account locked');

      // Reset lockout for subsequent tests
      await UserModel.updateOne({ email: 'doctor@test.org' }, { $set: { 'lockout.count': 0, 'lockout.until': null } });
    });
  });

  describe('Rotating Refresh Tokens & Reuse Detection', () => {
    it('rotates refresh token successfully and rejects reused previous token', async () => {
      // 1. Initial Login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reception@test.org', password: 'Password123!@#' });

      receptionistToken = loginRes.body.data.accessToken;
      const setCookie = loginRes.headers['set-cookie'] as unknown as string[];
      const firstRefreshCookie = setCookie.find((c: string) => c.startsWith('refreshToken='))!;
      const firstRefreshToken = firstRefreshCookie.split(';')[0].split('=')[1];

      // 2. First Refresh Rotation (Legitimate)
      const refreshRes1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${firstRefreshToken}`]);

      expect(refreshRes1.status).toBe(200);
      expect(refreshRes1.body.data.accessToken).toBeDefined();

      const secondSetCookie = refreshRes1.headers['set-cookie'] as unknown as string[];
      const secondRefreshCookie = secondSetCookie.find((c: string) => c.startsWith('refreshToken='))!;
      const secondRefreshToken = secondRefreshCookie.split(';')[0].split('=')[1];

      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      // 3. Token Reuse Attempt (Attacker replays firstRefreshToken)
      const attackRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${firstRefreshToken}`]);

      expect(attackRes.status).toBe(401);
      expect(attackRes.body.detail).toContain('reuse');

      // 4. Token Family Revocation: Even secondRefreshToken must now be revoked!
      const subsequentRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${secondRefreshToken}`]);

      expect(subsequentRes.status).toBe(401);
    });
  });

  describe('RBAC & ABAC Permission Enforcement', () => {
    it('allows Super Admin to view and create users', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@test.org',
          password: 'Password123!@#',
          name: { given: ['Test'], family: 'Nurse' },
          roleIds: [physicianRoleId],
          facilityIds: [mockFacilityId],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('newuser@test.org');
    });

    it('denies Receptionist from accessing admin user management (403 Forbidden)', async () => {
      // Re-login receptionist
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'reception@test.org', password: 'Password123!@#' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'hacker@test.org',
          password: 'Password123!@#',
          name: { given: ['Bad'], family: 'Actor' },
          roleIds: [adminRoleId],
          facilityIds: [mockFacilityId],
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('rejects unauthenticated requests (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
    });
  });

  describe('Tamper-Evident SHA-256 Hash Chain Integrity', () => {
    it('verifies valid mathematical hash chain across all recorded events', async () => {
      const report = await AuditService.verifyChainIntegrity();
      expect(report.isValid).toBe(true);
      expect(report.totalRecords).toBeGreaterThan(0);
    });

    it('detects tampering or sequence corruption immediately', async () => {
      // Tamper with the earliest audit record
      const firstLog = await AuditLogModel.findOne().sort({ seq: 1 });
      expect(firstLog).toBeDefined();

      const originalAction = firstLog!.action;
      await AuditLogModel.updateOne({ _id: firstLog!._id }, { $set: { action: 'TAMPERED_ACTION' } });

      const tamperedReport = await AuditService.verifyChainIntegrity();
      expect(tamperedReport.isValid).toBe(false);
      expect(tamperedReport.corruptedSeq).toBe(firstLog!.seq);
      expect(tamperedReport.details).toContain('Hash signature tampering');

      // Restore original
      await AuditLogModel.updateOne({ _id: firstLog!._id }, { $set: { action: originalAction } });
      const restoredReport = await AuditService.verifyChainIntegrity();
      expect(restoredReport.isValid).toBe(true);
    });
  });
});
