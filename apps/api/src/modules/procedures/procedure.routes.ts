import { Router } from 'express';
import { ProcedureController } from './procedure.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateProcedureSchema, CreateProcedureCatalogSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/catalog', ProcedureController.listCatalog);
router.post('/catalog', authorize(PERMISSIONS.PROCEDURE_CATALOG_MANAGE), validateBody(CreateProcedureCatalogSchema), ProcedureController.createCatalogItem);

router.get('/', authorize(PERMISSIONS.PROCEDURE_READ), ProcedureController.listByPatient);
router.post('/', authorize(PERMISSIONS.PROCEDURE_PERFORM_MINOR), validateBody(CreateProcedureSchema), ProcedureController.recordProcedure);
router.post('/:id/complete', authorize(PERMISSIONS.PROCEDURE_PERFORM_MINOR), ProcedureController.completeProcedure);
router.patch('/:id/complete', authorize(PERMISSIONS.PROCEDURE_PERFORM_MINOR), ProcedureController.completeProcedure);
router.post('/:id/error', authorize(PERMISSIONS.PROCEDURE_PERFORM_MINOR), ProcedureController.markInError);
router.patch('/:id/error', authorize(PERMISSIONS.PROCEDURE_PERFORM_MINOR), ProcedureController.markInError);

export const procedureRoutes = router;
