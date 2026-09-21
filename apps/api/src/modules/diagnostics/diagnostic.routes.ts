import { Router } from 'express';
import { DiagnosticController } from './diagnostic.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateLabResultSchema, CreateImagingReportSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Lab Results
router.get('/labs', authorize(PERMISSIONS.LAB_RESULTS_VIEW), DiagnosticController.listLabResultsByPatient);
router.post(
  '/labs',
  authorize(PERMISSIONS.LAB_RESULTS_ENTER),
  validateBody(CreateLabResultSchema),
  DiagnosticController.createLabResult
);

// Imaging Reports
router.get(
  '/imaging',
  authorize(PERMISSIONS.RADIOLOGY_REPORTS_VIEW),
  DiagnosticController.listImagingReportsByPatient
);
router.get(
  '/imaging/:id',
  authorize(PERMISSIONS.RADIOLOGY_REPORTS_VIEW),
  DiagnosticController.getImagingReportById
);
router.post(
  '/imaging',
  authorize(PERMISSIONS.RADIOLOGY_REPORTS_CREATE),
  validateBody(CreateImagingReportSchema),
  DiagnosticController.createImagingReport
);

export const diagnosticRoutes = router;
