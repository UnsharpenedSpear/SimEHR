import { Router } from 'express';
import { PatientController } from './patient.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  PatientSearchQuerySchema,
  BreakGlassInputSchema,
  MergePatientInputSchema,
  PERMISSIONS,
} from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/search', authorize(PERMISSIONS.PATIENT_READ), validateQuery(PatientSearchQuerySchema), PatientController.searchPatients);
router.post('/check-duplicates', authorize(PERMISSIONS.PATIENT_CREATE), PatientController.checkDuplicates);
router.post('/', authorize(PERMISSIONS.PATIENT_CREATE), validateBody(CreatePatientSchema), PatientController.createPatient);
router.get('/:id', authorize(PERMISSIONS.PATIENT_READ), PatientController.getPatientById);
router.post('/:id/break-glass', authorize(PERMISSIONS.PATIENT_BREAK_GLASS), validateBody(BreakGlassInputSchema), PatientController.breakGlass);
router.post('/:id/merge', authorize(PERMISSIONS.PATIENT_MERGE), validateBody(MergePatientInputSchema), PatientController.mergePatients);

export const patientRoutes = router;
