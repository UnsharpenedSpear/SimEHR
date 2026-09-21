import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../constants/status.js';

export const CreateAppointmentSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  facilityId: z.string().min(1),
  departmentId: z.string().min(1),
  type: z.enum(['ROUTINE', 'FOLLOW_UP', 'NEW_PATIENT', 'URGENT', 'PROCEDURE', 'TELEHEALTH']),
  start: z.string().datetime(),
  end: z.string().datetime(),
  reason: z.string().min(1),
  room: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => new Date(data.end) > new Date(data.start), {
  message: 'End time must be after start time',
  path: ['end'],
});
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

export const UpdateAppointmentStatusSchema = z.object({
  status: z.enum([
    APPOINTMENT_STATUSES.CONFIRMED,
    APPOINTMENT_STATUSES.ARRIVED,
    APPOINTMENT_STATUSES.CHECKED_IN,
    APPOINTMENT_STATUSES.IN_CONSULTATION,
    APPOINTMENT_STATUSES.COMPLETED,
    APPOINTMENT_STATUSES.CANCELLED,
    APPOINTMENT_STATUSES.NO_SHOW,
  ]),
  cancellationReason: z.string().optional(),
});
export type UpdateAppointmentStatusInput = z.infer<typeof UpdateAppointmentStatusSchema>;
