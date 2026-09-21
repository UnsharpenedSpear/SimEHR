import { Router } from 'express';
import { PrescriptionController } from './prescription.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import {
  CreatePrescriptionSchema,
  VerifyPrescriptionSchema,
  DispensePrescriptionSchema,
  PERMISSIONS,
} from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.PRESCRIPTION_READ), PrescriptionController.listByPatient);
router.post('/check-interactions', authorize(PERMISSIONS.PRESCRIPTION_PRESCRIBE), PrescriptionController.checkInteractions);
router.post('/', authorize(PERMISSIONS.PRESCRIPTION_PRESCRIBE), validateBody(CreatePrescriptionSchema), PrescriptionController.createPrescription);
router.post('/:id/verify', authorize(PERMISSIONS.PRESCRIPTION_VERIFY), validateBody(VerifyPrescriptionSchema), PrescriptionController.verifyPrescription);
router.patch('/:id/verify', authorize(PERMISSIONS.PRESCRIPTION_VERIFY), validateBody(VerifyPrescriptionSchema), PrescriptionController.verifyPrescription);
router.post('/:id/dispense', authorize(PERMISSIONS.PRESCRIPTION_DISPENSE), validateBody(DispensePrescriptionSchema), PrescriptionController.dispensePrescription);
router.patch('/:id/dispense', authorize(PERMISSIONS.PRESCRIPTION_DISPENSE), validateBody(DispensePrescriptionSchema), PrescriptionController.dispensePrescription);

export const prescriptionRoutes = router;
