import { Router } from 'express';
import { ClinicalNoteController } from './clinicalNote.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateClinicalNoteSchema, AmendClinicalNoteSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.NOTE_READ), ClinicalNoteController.listByPatient);
router.post('/', authorize(PERMISSIONS.NOTE_WRITE), validateBody(CreateClinicalNoteSchema), ClinicalNoteController.createDraft);
router.post('/:id/sign', authorize(PERMISSIONS.NOTE_SIGN), ClinicalNoteController.signNote);
router.post('/:id/amend', authorize(PERMISSIONS.NOTE_AMEND), validateBody(AmendClinicalNoteSchema), ClinicalNoteController.amendNote);

export const clinicalNoteRoutes = router;
