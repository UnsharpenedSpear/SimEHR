import { Router } from 'express';
import { SavedSearchController } from './savedSearch.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateSavedSearchSchema } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', SavedSearchController.listSavedSearches);
router.post('/', validateBody(CreateSavedSearchSchema), SavedSearchController.createSavedSearch);
router.post('/:id/run', SavedSearchController.executeSavedSearch);

export const savedSearchRoutes = router;
