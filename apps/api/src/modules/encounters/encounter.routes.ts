import { Router } from 'express';
import { EncounterController } from './encounter.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateEncounterSchema, UpdateEncounterDispositionSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.ENCOUNTER_READ), EncounterController.listByPatient);
router.post('/', authorize(PERMISSIONS.ENCOUNTER_CREATE), validateBody(CreateEncounterSchema), EncounterController.createEncounter);
router.patch('/:id/disposition', authorize(PERMISSIONS.ENCOUNTER_DISCHARGE), validateBody(UpdateEncounterDispositionSchema), EncounterController.updateDisposition);

export const encounterRoutes = router;
