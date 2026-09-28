import { Router } from 'express';
import { DepartmentController } from './department.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', DepartmentController.list);
router.get('/:id', DepartmentController.getById);
router.post('/', authorize(PERMISSIONS.SYSTEM_CONFIG), DepartmentController.create);

export const departmentRoutes = router;
