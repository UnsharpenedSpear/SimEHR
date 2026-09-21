import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateUserSchema, UpdateUserSchema, PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.USER_READ), UserController.listUsers);
router.get('/:id', authorize(PERMISSIONS.USER_READ), UserController.getUserById);
router.post('/', authorize(PERMISSIONS.USER_CREATE), validateBody(CreateUserSchema), UserController.createUser);
router.patch('/:id', authorize(PERMISSIONS.USER_UPDATE), validateBody(UpdateUserSchema), UserController.updateUser);
router.post('/mfa/setup', UserController.setupMFA);

export const userRoutes = router;
