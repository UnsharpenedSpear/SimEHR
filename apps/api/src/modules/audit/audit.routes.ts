import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.AUDIT_READ), AuditController.listAuditLogs);
router.get('/verify', authorize(PERMISSIONS.AUDIT_READ), AuditController.verifyAuditChain);
router.get('/patients/:id/access-report', authorize(PERMISSIONS.AUDIT_READ), AuditController.getPatientAccessReport);

export const auditRoutes = router;
