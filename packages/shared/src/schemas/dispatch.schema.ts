import { z } from 'zod';
import { DISPATCH_STATUSES, DISPATCH_TYPES, ORDER_PRIORITIES } from '../constants/status.js';

export const CreateDispatchSchema = z.object({
  orderId: z.string().min(1),
  patientId: z.string().min(1),
  facilityId: z.string().min(1),
  type: z.enum([
    DISPATCH_TYPES.LAB_SPECIMEN,
    DISPATCH_TYPES.PHARMACY_PRESCRIPTION,
    DISPATCH_TYPES.RADIOLOGY_REQUEST,
    DISPATCH_TYPES.PROCEDURE_ROOM_OT,
    DISPATCH_TYPES.WARD_BED_TRANSFER,
    DISPATCH_TYPES.PATIENT_TRANSPORT,
    DISPATCH_TYPES.EXTERNAL_REFERRAL,
  ]),
  fromDeptId: z.string().min(1),
  toDeptId: z.string().min(1),
  priority: z.enum([ORDER_PRIORITIES.ROUTINE, ORDER_PRIORITIES.URGENT, ORDER_PRIORITIES.STAT]),
  notes: z.string().optional(),
  slaMinutes: z.number().int().min(1).optional(),
});
export type CreateDispatchInput = z.infer<typeof CreateDispatchSchema>;

export const TransitionDispatchSchema = z.object({
  targetStatus: z.enum([
    DISPATCH_STATUSES.DISPATCHED,
    DISPATCH_STATUSES.ACKNOWLEDGED,
    DISPATCH_STATUSES.IN_PROGRESS,
    DISPATCH_STATUSES.COMPLETED,
    DISPATCH_STATUSES.REJECTED,
    DISPATCH_STATUSES.ON_HOLD,
    DISPATCH_STATUSES.CANCELLED,
  ]),
  reason: z.string().optional(),
  location: z.string().optional(),
  meta: z.record(z.any()).optional(),
}).superRefine((data, ctx) => {
  if (
    (data.targetStatus === DISPATCH_STATUSES.REJECTED ||
      data.targetStatus === DISPATCH_STATUSES.ON_HOLD ||
      data.targetStatus === DISPATCH_STATUSES.CANCELLED) &&
    (!data.reason || data.reason.trim().length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Reason is mandatory when transitioning to ${data.targetStatus}`,
      path: ['reason'],
    });
  }
});
export type TransitionDispatchInput = z.infer<typeof TransitionDispatchSchema>;

export const BatchTransitionDispatchSchema = z.object({
  dispatchIds: z.array(z.string()).min(1, 'At least one dispatch ID is required'),
  targetStatus: z.enum([
    DISPATCH_STATUSES.DISPATCHED,
    DISPATCH_STATUSES.ACKNOWLEDGED,
    DISPATCH_STATUSES.IN_PROGRESS,
    DISPATCH_STATUSES.COMPLETED,
    DISPATCH_STATUSES.REJECTED,
    DISPATCH_STATUSES.ON_HOLD,
    DISPATCH_STATUSES.CANCELLED,
  ]),
  reason: z.string().optional(),
});
export type BatchTransitionDispatchInput = z.infer<typeof BatchTransitionDispatchSchema>;

export const DispatchBoardQuerySchema = z.object({
  departmentId: z.string().optional(),
  facilityId: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
});
export type DispatchBoardQuery = z.infer<typeof DispatchBoardQuerySchema>;
