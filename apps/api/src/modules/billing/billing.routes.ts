import { Router } from 'express';
import { BillingController } from './billing.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateInvoiceSchema, RecordPaymentSchema, PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/invoices', authorize(PERMISSIONS.BILLING_VIEW), BillingController.list);
router.get('/invoices/:id', authorize(PERMISSIONS.BILLING_VIEW), BillingController.getById);
router.post('/invoices', authorize(PERMISSIONS.BILLING_CREATE), validateBody(CreateInvoiceSchema), BillingController.createInvoice);
router.post(
  '/invoices/:id/payments',
  authorize(PERMISSIONS.BILLING_PAYMENT_PROCESS),
  validateBody(RecordPaymentSchema),
  BillingController.recordPayment
);

export const billingRoutes = router;
