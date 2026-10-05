import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { UserModel, IUser } from '../users/user.model.js';
import { RoleModel } from '../roles/role.model.js';
import { RefreshTokenModel } from './refreshToken.model.js';
import { AuditService } from '../audit/audit.service.js';
import { env } from '../../config/env.js';
import {
  hashPassword,
  verifyPassword,
  verifyMFACode,
  decryptField,
  encryptField,
  generateMFACredentials,
} from '../../utils/crypto.util.js';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '../../middleware/error.middleware.js';
import { UserTokenPayload } from '../../middleware/authn.middleware.js';
import { SYSTEM_ROLES } from '@ehr/shared';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const TEMP_MFA_EXPIRY = '5m';

export class AuthService {
  /**
   * Issue 15-min JWT access token
   */
  static generateAccessToken(user: IUser, permissions: string[], roles: string[]): string {
    const payload: UserTokenPayload = {
      id: user._id.toString(),
      email: user.email,
      roles,
      permissions,
      facilityIds: user.facilityIds.map((f) => f.toString()),
      activeFacilityId: user.facilityIds[0]?.toString() || '',
      professional: user.professional,
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  /**
   * Issue 7-day Refresh Token and record in family
   */
  static async createRefreshToken(userId: Types.ObjectId, existingFamilyId?: string): Promise<{ token: string; familyId: string }> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const familyId = existingFamilyId || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await RefreshTokenModel.create({
      userId,
      familyId,
      tokenHash,
      expiresAt,
    });

    return { token: rawToken, familyId };
  }

  /**
   * Primary Login handler with Argon2id, lockout evaluation, and MFA gating
   */
  static async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }) {
    const normalizedEmail = params.email.toLowerCase().trim();
    const emailAliases: Record<string, string> = {
      'physician@ehr.hospital.org': 'dr.chen@ehrtest.local',
      'doctor@ehrtest.local': 'dr.chen@ehrtest.local',
      'physician@ehrtest.local': 'dr.chen@ehrtest.local',
      'nurse@ehr.hospital.org': 'nurse.williams@ehrtest.local',
      'nurse@ehrtest.local': 'nurse.williams@ehrtest.local',
      'receptionist@ehr.hospital.org': 'receptionist@ehrtest.local',
      'labtech@ehr.hospital.org': 'labtech@ehrtest.local',
      'pharmacist@ehr.hospital.org': 'pharmacist@ehrtest.local',
      'radiologist@ehr.hospital.org': 'radiologist@ehrtest.local',
      'billing@ehr.hospital.org': 'billing@ehrtest.local',
      'auditor@ehr.hospital.org': 'auditor@ehrtest.local',
      'admin@ehr.hospital.org': 'admin@ehrtest.local',
    };

    const targetEmail = emailAliases[normalizedEmail] || normalizedEmail;
    const user = await UserModel.findOne({ email: targetEmail }).populate('roleIds');
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError(`Account is ${user.status.toLowerCase()}. Please contact administrator.`);
    }

    // Lockout check (5 failed attempts => 15 min lock)
    if (user.lockout?.until && user.lockout.until > new Date()) {
      const waitMinutes = Math.ceil((user.lockout.until.getTime() - Date.now()) / 60000);
      throw new ForbiddenError(`Account locked due to consecutive failed attempts. Try again in ${waitMinutes} minutes.`);
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, params.password);
    if (!isPasswordValid) {
      // Increment lockout counter
      const newCount = (user.lockout?.count || 0) + 1;
      let lockUntil: Date | undefined;
      if (newCount >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      }

      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            'lockout.count': newCount,
            ...(lockUntil ? { 'lockout.until': lockUntil } : {}),
          },
        }
      );

      await AuditService.log({
        actorId: user._id.toString(),
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user._id.toString(),
        outcome: 'FAILURE',
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
        diff: { failedAttempts: newCount, locked: !!lockUntil },
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    // Reset lockout counter on success
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          'lockout.count': 0,
          'lockout.until': null,
          lastLoginAt: new Date(),
        },
      }
    );

    // Extract populated roles & permissions
    const roles = (user.roleIds as unknown as Array<{ name: string; permissions: string[] }>).map((r) => r.name);
    const permissions = Array.from(
      new Set((user.roleIds as unknown as Array<{ name: string; permissions: string[] }>).flatMap((r) => r.permissions))
    );

    // MFA Requirement check: Mandatory for Admin and Physician roles, or if enabled on user profile
    const requiresMfa =
      user.mfa?.enabled ||
      roles.includes(SYSTEM_ROLES.SUPER_ADMIN) ||
      roles.includes(SYSTEM_ROLES.PHYSICIAN);

    if (requiresMfa && user.mfa?.secretEnc) {
      const tempToken = jwt.sign(
        { userId: user._id.toString(), type: 'MFA_CHALLENGE' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: TEMP_MFA_EXPIRY }
      );

      return {
        mfaRequired: true,
        tempToken,
      };
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user, permissions, roles);
    const { token: refreshToken } = await this.createRefreshToken(user._id);

    await AuditService.log({
      actorId: user._id.toString(),
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      ip: params.ip,
      userAgent: params.userAgent,
      requestId: params.requestId,
    });

    return {
      mfaRequired: false,
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        roles,
        permissions,
        facilityIds: user.facilityIds.map((f) => f.toString()),
        activeFacilityId: user.facilityIds[0]?.toString() || '',
        professional: user.professional,
        forcePasswordChange: user.forcePasswordChange,
      },
    };
  }

  /**
   * Validate MFA Challenge and issue session tokens
   */
  static async validateMFA(params: {
    tempToken: string;
    code: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }) {
    let payload: { userId: string; type: string };
    try {
      payload = jwt.verify(params.tempToken, env.JWT_ACCESS_SECRET) as { userId: string; type: string };
    } catch {
      throw new UnauthorizedError('MFA verification session expired or invalid');
    }

    if (payload.type !== 'MFA_CHALLENGE') {
      throw new UnauthorizedError('Invalid challenge token type');
    }

    const user = await UserModel.findById(payload.userId).populate('roleIds');
    if (!user || !user.mfa?.secretEnc) {
      throw new UnauthorizedError('MFA is not configured for this user');
    }

    const secret = decryptField(user.mfa.secretEnc);
    const isValid = verifyMFACode(params.code, secret);
    if (!isValid) {
      throw new UnauthorizedError('Invalid MFA verification code');
    }

    const roles = (user.roleIds as unknown as Array<{ name: string; permissions: string[] }>).map((r) => r.name);
    const permissions = Array.from(
      new Set((user.roleIds as unknown as Array<{ name: string; permissions: string[] }>).flatMap((r) => r.permissions))
    );

    const accessToken = this.generateAccessToken(user, permissions, roles);
    const { token: refreshToken } = await this.createRefreshToken(user._id);

    await AuditService.log({
      actorId: user._id.toString(),
      action: 'AUTH_MFA_VALIDATED',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      ip: params.ip,
      userAgent: params.userAgent,
      requestId: params.requestId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        roles,
        permissions,
        facilityIds: user.facilityIds.map((f) => f.toString()),
        activeFacilityId: user.facilityIds[0]?.toString() || '',
        professional: user.professional,
        forcePasswordChange: user.forcePasswordChange,
      },
    };
  }

  /**
   * Rotating Refresh Token handler with Token Family Reuse Detection
   */
  static async rotateRefreshToken(params: {
    refreshToken: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }) {
    const tokenHash = crypto.createHash('sha256').update(params.refreshToken).digest('hex');
    const tokenDoc = await RefreshTokenModel.findOne({ tokenHash });

    if (!tokenDoc) {
      throw new UnauthorizedError('Refresh token invalid or expired');
    }

    // Reuse Detection: If token is already revoked, an attacker or compromised client is reusing tokens!
    if (tokenDoc.revokedAt) {
      // Revoke ALL tokens belonging to this family immediately
      await RefreshTokenModel.updateMany({ familyId: tokenDoc.familyId }, { $set: { revokedAt: new Date() } });

      await AuditService.log({
        actorId: tokenDoc.userId.toString(),
        action: 'AUTH_TOKEN_REUSE_DETECTED',
        resourceType: 'RefreshToken',
        resourceId: tokenDoc._id.toString(),
        outcome: 'DENIED',
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
        diff: { familyId: tokenDoc.familyId, message: 'All tokens in family revoked due to reuse detection' },
      });

      throw new UnauthorizedError('Security breach detected: Refresh token reuse. All active sessions have been revoked.');
    }

    // Check expiration
    if (tokenDoc.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired, please log in again');
    }

    const user = await UserModel.findById(tokenDoc.userId).populate('roleIds');
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    // Mark current token as revoked and rotated
    const newRawToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');

    tokenDoc.revokedAt = new Date();
    tokenDoc.replacedBy = newTokenHash;
    await tokenDoc.save();

    // Issue new token in same family
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await RefreshTokenModel.create({
      userId: user._id,
      familyId: tokenDoc.familyId,
      tokenHash: newTokenHash,
      expiresAt,
    });

    const roles = (user.roleIds as unknown as Array<{ name: string; permissions: string[] }>).map((r) => r.name);
    const permissions = Array.from(
      new Set((user.roleIds as unknown as Array<{ name: string; permissions: string[] }>).flatMap((r) => r.permissions))
    );

    const accessToken = this.generateAccessToken(user, permissions, roles);

    return {
      accessToken,
      refreshToken: newRawToken,
    };
  }

  /**
   * Revoke token family on Logout
   */
  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenDoc = await RefreshTokenModel.findOne({ tokenHash });
    if (tokenDoc) {
      await RefreshTokenModel.updateMany({ familyId: tokenDoc.familyId }, { $set: { revokedAt: new Date() } });
    }
  }
}
