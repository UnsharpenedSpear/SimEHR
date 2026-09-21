import { Router } from 'express';
import { AppointmentController } from './appointment.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';
import { authorize } from '../../middleware/authz.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { CreateAppointmentSchema, UpdateAppointmentStatusSchema, PERMISSIONS } from '@ehr/shared';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.APPOINTMENT_VIEW), AppointmentController.list);
router.get('/:id', authorize(PERMISSIONS.APPOINTMENT_VIEW), AppointmentController.getById);
router.post('/', authorize(PERMISSIONS.APPOINTMENT_CREATE), validateBody(CreateAppointmentSchema), AppointmentController.create);
router.patch(
  '/:id/status',
  authorize(PERMISSIONS.APPOINTMENT_UPDATE),
  validateBody(UpdateAppointmentStatusSchema),
  AppointmentController.updateStatus
);
router.post('/:id/check-in', authorize(PERMISSIONS.APPOINTMENT_CHECKIN), AppointmentController.checkIn);

export const appointmentRoutes = router;
