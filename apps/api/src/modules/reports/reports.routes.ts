import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/census', authorize(PERMISSIONS.ENCOUNTER_READ), ReportsController.getCensusReport);
router.get('/dispatch-sla', authorize(PERMISSIONS.REPORT_VIEW), ReportsController.getDispatchSlaReport);
router.get('/financial', authorize(PERMISSIONS.REPORT_VIEW), ReportsController.getFinancialReport);

export const reportRoutes = router;
