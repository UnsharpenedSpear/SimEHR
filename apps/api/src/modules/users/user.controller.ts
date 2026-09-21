import { Request, Response, NextFunction } from 'express';
import { UserModel } from './user.model.js';
import { RoleModel } from '../roles/role.model.js';
import { AuditService } from '../audit/audit.service.js';
import { hashPassword, generateMFACredentials, encryptField } from '../../utils/crypto.util.js';
import { NotFoundError, ConflictError } from '../../middleware/error.middleware.js';

export class UserController {
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await UserModel.find()
        .populate('roleIds', 'name permissions isSystem')
        .select('-passwordHash -mfa.secretEnc -mfa.recoveryCodesHash')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        status: 'SUCCESS',
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserModel.findById(req.params.id)
        .populate('roleIds', 'name permissions isSystem')
        .select('-passwordHash -mfa.secretEnc -mfa.recoveryCodesHash')
        .lean();

      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.status(200).json({
        status: 'SUCCESS',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, roleIds, facilityIds, departmentIds, professional } = req.body;

      const existing = await UserModel.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw new ConflictError('A user with this email address already exists');
      }

      const passwordHash = await hashPassword(password);
      const user = await UserModel.create({
        email: email.toLowerCase(),
        passwordHash,
        name,
        roleIds,
        facilityIds,
        departmentIds: departmentIds || [],
        professional,
        status: 'ACTIVE',
        forcePasswordChange: true,
      });

      await AuditService.log({
        actorId: req.user?.id || 'SYSTEM',
        action: 'USER_CREATE',
        resourceType: 'User',
        resourceId: user._id.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { email: user.email, roles: roleIds },
      });

      res.status(201).json({
        status: 'SUCCESS',
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          roleIds: user.roleIds,
          facilityIds: user.facilityIds,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updateData: any = { ...req.body };
      if (updateData.password) {
        updateData.passwordHash = await hashPassword(updateData.password);
        delete updateData.password;
      }

      const user = await UserModel.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true })
        .populate('roleIds', 'name permissions isSystem')
        .select('-passwordHash -mfa.secretEnc -mfa.recoveryCodesHash');

      if (!user) {
        throw new NotFoundError('User not found');
      }

      await AuditService.log({
        actorId: req.user?.id || 'SYSTEM',
        action: 'USER_UPDATE',
        resourceType: 'User',
        resourceId: user._id.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: req.body,
      });

      res.status(200).json({
        status: 'SUCCESS',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async setupMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const user = await UserModel.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const mfaCreds = await generateMFACredentials(user.email);
      user.mfa = {
        enabled: true,
        secretEnc: encryptField(mfaCreds.secret),
      };
      await user.save();

      await AuditService.log({
        actorId: userId!,
        action: 'USER_MFA_SETUP',
        resourceType: 'User',
        resourceId: userId,
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
      });

      res.status(200).json({
        status: 'SUCCESS',
        data: {
          secret: mfaCreds.secret,
          qrCodeDataUrl: mfaCreds.qrCodeDataUrl,
          otpauthUrl: mfaCreds.otpauthUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
