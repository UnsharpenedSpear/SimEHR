import { z } from 'zod';
import { ORDER_PRIORITIES, ORDER_STATUSES, ORDER_TYPES } from '../constants/status.js';

export const CreateOrderSchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  type: z.enum([
    ORDER_TYPES.LAB,
    ORDER_TYPES.IMAGING,
    ORDER_TYPES.MEDICATION,
    ORDER_TYPES.PROCEDURE,
    ORDER_TYPES.REFERRAL,
    ORDER_TYPES.DIET,
    ORDER_TYPES.NURSING_CARE,
  ]),
  catalogCode: z.string().optional(),
  name: z.string().min(1),
  priority: z.enum([ORDER_PRIORITIES.ROUTINE, ORDER_PRIORITIES.URGENT, ORDER_PRIORITIES.STAT]),
  indication: z.string().min(1),
  destinationDeptId: z.string().min(1),
  details: z.record(z.any()).default({}),
  autoDispatch: z.boolean().default(true),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const SignOrderSchema = z.object({
  pin: z.string().optional(), // Re-auth PIN if controlled substance
});
export type SignOrderInput = z.infer<typeof SignOrderSchema>;

export const CreatePrescriptionSchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  orderId: z.string().optional(),
  drug: z.object({
    code: z.string().min(1), // RxNorm
    name: z.string().min(1),
    strength: z.string().min(1),
    form: z.enum(['TABLET', 'CAPSULE', 'LIQUID', 'INJECTION', 'INHALER', 'TOPICAL', 'DROPS', 'PATCH']),
  }),
  dosage: z.object({
    dose: z.string().min(1),
    unit: z.string().min(1),
    route: z.enum(['ORAL', 'IV', 'IM', 'SC', 'TOPICAL', 'INHALATION', 'OPHTHALMIC', 'OTIC']),
    frequency: z.string().min(1), // e.g. "BID", "TID", "Q4H", "PRN"
  }),
  durationDays: z.number().int().min(1),
  quantity: z.number().min(1),
  refills: z.number().int().min(0).default(0),
  instructions: z.string().min(1),
  isControlled: z.boolean().default(false),
  overrideWarningReason: z.string().optional(),
});
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;

export const VerifyPrescriptionSchema = z.object({
  notes: z.string().optional(),
});
export type VerifyPrescriptionInput = z.infer<typeof VerifyPrescriptionSchema>;

export const DispensePrescriptionSchema = z.object({
  lotNumber: z.string().min(1),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantityDispensed: z.number().min(1),
  notes: z.string().optional(),
});
export type DispensePrescriptionInput = z.infer<typeof DispensePrescriptionSchema>;

export const CreateLabResultSchema = z.object({
  orderId: z.string().min(1),
  patientId: z.string().min(1),
  analyteCode: z.string().min(1), // LOINC
  analyteName: z.string().min(1),
  value: z.number().or(z.string()),
  unit: z.string().min(1),
  referenceRange: z.object({
    low: z.number().optional(),
    high: z.number().optional(),
    criticalLow: z.number().optional(),
    criticalHigh: z.number().optional(),
  }),
  notes: z.string().optional(),
});
export type CreateLabResultInput = z.infer<typeof CreateLabResultSchema>;

export const CreateImagingReportSchema = z.object({
  orderId: z.string().min(1),
  patientId: z.string().min(1),
  modality: z.string().min(1),
  findings: z.string().min(1),
  impression: z.string().min(1),
  recommendations: z.string().optional(),
  isCritical: z.boolean().default(false),
});
export type CreateImagingReportInput = z.infer<typeof CreateImagingReportSchema>;
