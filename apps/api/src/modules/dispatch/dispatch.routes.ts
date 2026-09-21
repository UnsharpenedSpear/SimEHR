import { Router } from 'express';
import { DispatchController } from './dispatch.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import {
  CreateDispatchSchema,
  TransitionDispatchSchema,
  BatchTransitionDispatchSchema,
  PERMISSIONS,
} from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.DISPATCH_VIEW), DispatchController.list);
router.get('/:id', authorize(PERMISSIONS.DISPATCH_VIEW), DispatchController.getById);
router.post('/', authorize(PERMISSIONS.DISPATCH_CREATE), validateBody(CreateDispatchSchema), DispatchController.create);

router.post(
  '/:id/transition',
  authorize(PERMISSIONS.DISPATCH_STATUS_UPDATE),
  validateBody(TransitionDispatchSchema),
  DispatchController.transitionStatus
);
router.patch(
  '/:id/transition',
  authorize(PERMISSIONS.DISPATCH_STATUS_UPDATE),
  validateBody(TransitionDispatchSchema),
  DispatchController.transitionStatus
);

router.post(
  '/batch-transition',
  authorize(PERMISSIONS.DISPATCH_STATUS_UPDATE),
  validateBody(BatchTransitionDispatchSchema),
  DispatchController.batchTransition
);

router.get('/:id/routing-slip', authorize(PERMISSIONS.DISPATCH_VIEW), DispatchController.getRoutingSlip);

export const dispatchRoutes = router;
