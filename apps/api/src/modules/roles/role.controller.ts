import { Request, Response, NextFunction } from 'express';
import { RoleModel } from './role.model.js';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../middleware/error.middleware.js';
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES } from '@ehr/shared';

export class RoleController {
  static async listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await RoleModel.find().sort({ isSystem: -1, name: 1 }).lean();
      res.status(200).json({
        status: 'SUCCESS',
        data: roles,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await RoleModel.findById(req.params.id).lean();
      if (!role) throw new NotFoundError('Role not found');
      res.status(200).json({ status: 'SUCCESS', data: role });
    } catch (err) {
      next(err);
    }
  }

  static async updateRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { permissions } = req.body;
      const role = await RoleModel.findById(req.params.id);
      if (!role) throw new NotFoundError('Role not found');

      if (role.name === SYSTEM_ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Super Admin permissions cannot be modified');
      }

      const prevPermissions = role.permissions;
      role.permissions = permissions;
      await role.save();

      await AuditService.log({
        actorId: req.user?.id || 'SYSTEM',
        action: 'ROLE_PERMISSIONS_UPDATE',
        resourceType: 'Role',
        resourceId: role._id.toString(),
        outcome: 'SUCCESS',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-correlation-id'] as string,
        diff: { prev: prevPermissions, new: permissions },
      });

      res.status(200).json({ status: 'SUCCESS', data: role });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Seed default system roles if they don't exist
   */
  static async ensureDefaultRoles(): Promise<void> {
    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      await RoleModel.findOneAndUpdate(
        { name: roleName },
        {
          $setOnInsert: {
            name: roleName,
            permissions,
            isSystem: true,
            description: `Built-in system role for ${roleName}`,
          },
        },
        { upsert: true, new: true }
      );
    }
  }
}
