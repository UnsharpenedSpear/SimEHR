import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { LoginInputSchema, MFALoginInputSchema } from '@ehr/shared';

const router = Router();

router.post('/login', authRateLimiter, validateBody(LoginInputSchema), AuthController.login);
router.post('/mfa/validate', authRateLimiter, validateBody(MFALoginInputSchema), AuthController.validateMFA);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', authenticate, AuthController.me);

export const authRoutes = router;
