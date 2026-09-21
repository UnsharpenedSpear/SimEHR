import { Router } from 'express';
import { ProblemController } from './problem.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateProblemSchema, PERMISSIONS } from '@ehr/shared';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.PROBLEM_READ), ProblemController.listByPatient);
router.post('/', authorize(PERMISSIONS.PROBLEM_WRITE), validateBody(CreateProblemSchema), ProblemController.createProblem);
router.patch('/:id/status', authorize(PERMISSIONS.PROBLEM_WRITE), ProblemController.updateStatus);

export const problemRoutes = router;
