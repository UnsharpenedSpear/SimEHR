import { Router } from 'express';
import { DocumentController } from './document.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.PATIENT_READ), DocumentController.listByPatient);
router.post('/', authorize(PERMISSIONS.PATIENT_UPDATE), DocumentController.uploadDocument);

export const documentRoutes = router;
