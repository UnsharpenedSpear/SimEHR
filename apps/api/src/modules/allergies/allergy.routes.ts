import { Router } from 'express';
import { AllergyController } from './allergy.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateAllergySchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.ALLERGY_READ), AllergyController.listByPatient);
router.post('/', authorize(PERMISSIONS.ALLERGY_WRITE), validateBody(CreateAllergySchema), AllergyController.createAllergy);

export const allergyRoutes = router;
