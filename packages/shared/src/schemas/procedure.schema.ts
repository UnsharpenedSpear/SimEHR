import { z } from 'zod';
import { PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '../constants/status.js';

export const CreateProcedureCatalogSchema = z.object({
  code: z.string().min(1),
  codeSystem: z.string().default('CPT'),
  name: z.string().min(1),
  category: z.enum([
    PROCEDURE_CATEGORIES.DIAGNOSTIC,
    PROCEDURE_CATEGORIES.THERAPEUTIC,
    PROCEDURE_CATEGORIES.SURGICAL,
    PROCEDURE_CATEGORIES.IMAGING,
    PROCEDURE_CATEGORIES.LABORATORY,
    PROCEDURE_CATEGORIES.IMMUNIZATION,
    PROCEDURE_CATEGORIES.REHABILITATIVE,
  ]),
  defaultDurationMin: z.number().int().min(1).default(30),
  requiredPermission: z.string().min(1),
  price: z.number().min(0),
  active: z.boolean().default(true),
  description: z.string().optional(),
});
export type CreateProcedureCatalogInput = z.infer<typeof CreateProcedureCatalogSchema>;

// Base Procedure schema
export const BaseProcedureSchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  catalogId: z.string().optional(),
  code: z.string().min(1),
  codeSystem: z.string().default('CPT'),
  name: z.string().min(1),
  category: z.enum([
    PROCEDURE_CATEGORIES.DIAGNOSTIC,
    PROCEDURE_CATEGORIES.THERAPEUTIC,
    PROCEDURE_CATEGORIES.SURGICAL,
    PROCEDURE_CATEGORIES.IMAGING,
    PROCEDURE_CATEGORIES.LABORATORY,
    PROCEDURE_CATEGORIES.IMMUNIZATION,
    PROCEDURE_CATEGORIES.REHABILITATIVE,
  ]),
  status: z
    .enum([
      PROCEDURE_STATUSES.PLANNED,
      PROCEDURE_STATUSES.IN_PROGRESS,
      PROCEDURE_STATUSES.COMPLETED,
      PROCEDURE_STATUSES.CANCELLED,
      PROCEDURE_STATUSES.ENTERED_IN_ERROR,
    ])
    .default(PROCEDURE_STATUSES.PLANNED),
  performedBy: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  performedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  consentRef: z.string().optional(),
});

// Category Specific details
export const DiagnosticDetailSchema = z.object({
  indication: z.string().min(1),
  findings: z.string().min(1),
  specimenId: z.string().optional(),
});

export const TherapeuticDetailSchema = z.object({
  site: z.string().min(1),
  technique: z.string().min(1),
  materials: z.array(z.string()).default([]),
  anesthesiaLocal: z.boolean().default(false),
});

export const SurgicalDetailSchema = z.object({
  surgeonId: z.string().min(1),
  assistants: z.array(z.string()).default([]),
  anesthesiologistId: z.string().optional(),
  anesthesiaType: z.enum(['GENERAL', 'SPINAL', 'EPIDURAL', 'REGIONAL', 'SEDATION', 'LOCAL']),
  preOpDiagnosis: z.string().min(1),
  postOpDiagnosis: z.string().min(1),
  asaClass: z.enum(['ASA_I', 'ASA_II', 'ASA_III', 'ASA_IV', 'ASA_V', 'ASA_VI', 'ASA_E']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  estimatedBloodLossMl: z.number().min(0).default(0),
  implants: z.array(z.string()).default([]),
  complications: z.string().optional(),
  whoChecklistCompleted: z.boolean().default(true),
});

export const ImagingDetailSchema = z.object({
  modality: z.enum(['XR', 'CT', 'MR', 'US', 'NM', 'PET', 'MAMMO']),
  bodyPart: z.string().min(1),
  contrastUsed: z.boolean().default(false),
  contrastAgent: z.string().optional(),
  radiationDoseMgy: z.number().optional(),
  studyUid: z.string().optional(),
});

export const LabDetailSchema = z.object({
  panelName: z.string().min(1),
  specimenType: z.string().min(1),
  collectionTime: z.string().datetime(),
});

export const ImmunizationDetailSchema = z.object({
  cvx: z.string().min(1),
  lot: z.string().min(1),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  site: z.string().min(1),
  route: z.string().min(1),
  dose: z.string().min(1),
});

export const RehabDetailSchema = z.object({
  sessionNumber: z.number().int().min(1),
  modality: z.string().min(1),
  durationMin: z.number().int().min(1),
  patientResponse: z.string().min(1),
});

export const CreateProcedureSchema = BaseProcedureSchema.extend({
  diagnosticDetails: DiagnosticDetailSchema.optional(),
  therapeuticDetails: TherapeuticDetailSchema.optional(),
  surgicalDetails: SurgicalDetailSchema.optional(),
  imagingDetails: ImagingDetailSchema.optional(),
  labDetails: LabDetailSchema.optional(),
  immunizationDetails: ImmunizationDetailSchema.optional(),
  rehabDetails: RehabDetailSchema.optional(),
}).passthrough();
export type CreateProcedureInput = z.infer<typeof CreateProcedureSchema>;
