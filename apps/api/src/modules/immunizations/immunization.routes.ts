import { Router } from 'express';
import { ImmunizationController } from './immunization.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateImmunizationSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.PATIENT_READ), ImmunizationController.listByPatient);
router.post('/', authorize(PERMISSIONS.PROCEDURE_PERFORM_MINOR), validateBody(CreateImmunizationSchema), ImmunizationController.recordImmunization);

export const immunizationRoutes = router;
