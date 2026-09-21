import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from './error.middleware.js';
import { SYSTEM_ROLES, Permission } from '@ehr/shared';

export interface AuthorizeOptions {
  checkFacility?: boolean;
  facilityParam?: string;
  allowedRoles?: string[];
}

export function authorize(requiredPermission?: Permission | string, options: AuthorizeOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(new UnauthorizedError('User authentication required'));
      return;
    }

    // Super Admin override
    if (user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      next();
      return;
    }

    // Role-level whitelist check if specified
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      const hasAllowedRole = user.roles.some((r) => options.allowedRoles!.includes(r));
      if (!hasAllowedRole) {
        next(new ForbiddenError(`Access restricted to roles: ${options.allowedRoles.join(', ')}`));
        return;
      }
    }

    // Permission check
    if (requiredPermission) {
      const hasPerm = user.permissions.includes(requiredPermission);
      if (!hasPerm) {
        next(new ForbiddenError(`Missing required permission: ${requiredPermission}`));
        return;
      }
    }

    // ABAC Facility Scoping check
    if (options.checkFacility) {
      const targetFacilityId =
        req.body?.facilityId ||
        req.query?.facilityId ||
        (options.facilityParam ? req.params[options.facilityParam] : undefined);

      if (targetFacilityId && !user.facilityIds.includes(String(targetFacilityId))) {
        next(new ForbiddenError('You are not authorized to access resources in this facility'));
        return;
      }
    }

    next();
  };
}
