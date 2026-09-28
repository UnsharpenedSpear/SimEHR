import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { idempotency } from '../../middleware/idempotency.middleware.js';
import { CreateOrderSchema, SignOrderSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.ORDER_READ), OrderController.listByPatient);
// Idempotency guard: prevents duplicate orders on client retry
router.post('/', authorize(PERMISSIONS.ORDER_CREATE), idempotency, validateBody(CreateOrderSchema), OrderController.createOrder);
router.post('/:id/sign', authorize(PERMISSIONS.ORDER_SIGN), validateBody(SignOrderSchema), OrderController.signOrder);
router.patch('/:id/sign', authorize(PERMISSIONS.ORDER_SIGN), validateBody(SignOrderSchema), OrderController.signOrder);
router.post('/:id/cancel', authorize(PERMISSIONS.ORDER_CANCEL), OrderController.cancelOrder);
router.patch('/:id/cancel', authorize(PERMISSIONS.ORDER_CANCEL), OrderController.cancelOrder);

export const orderRoutes = router;
