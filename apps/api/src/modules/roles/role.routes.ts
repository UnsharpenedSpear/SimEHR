import { Router } from 'express';
import { RoleController } from './role.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.ROLE_MANAGE), RoleController.listRoles);
router.get('/:id', authorize(PERMISSIONS.ROLE_MANAGE), RoleController.getRoleById);
router.patch('/:id/permissions', authorize(PERMISSIONS.ROLE_MANAGE), RoleController.updateRolePermissions);

export const roleRoutes = router;
