import { Router } from 'express';
import { VitalsController } from './vitals.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateVitalsSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.VITALS_READ), VitalsController.listByPatient);
router.get('/trend', authorize(PERMISSIONS.VITALS_READ), VitalsController.getTrends);
router.post('/', authorize(PERMISSIONS.VITALS_WRITE), validateBody(CreateVitalsSchema), VitalsController.recordVitals);

export const vitalsRoutes = router;
