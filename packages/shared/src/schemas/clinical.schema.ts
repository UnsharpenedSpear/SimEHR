import { z } from 'zod';
import {
  CLINICAL_NOTE_STATUSES,
  CLINICAL_NOTE_TEMPLATES,
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPES,
} from '../constants/status.js';

export const CodedDiagnosisSchema = z.object({
  code: z.string().min(1),
  system: z.string().default('http://hl7.org/fhir/sid/icd-10'),
  display: z.string().min(1),
  rank: z.number().int().min(1).default(1),
  isPrimary: z.boolean().default(false),
});

export const CreateEncounterSchema = z.object({
  patientId: z.string().min(1),
  facilityId: z.string().min(1),
  type: z.enum([
    ENCOUNTER_TYPES.OUTPATIENT,
    ENCOUNTER_TYPES.INPATIENT,
    ENCOUNTER_TYPES.EMERGENCY,
    ENCOUNTER_TYPES.TELEHEALTH,
  ]),
  departmentId: z.string().min(1),
  attendingId: z.string().min(1),
  reasonForVisit: z.string().min(1),
  diagnoses: z.array(CodedDiagnosisSchema).default([]),
  start: z.string().datetime().optional(),
});
export type CreateEncounterInput = z.infer<typeof CreateEncounterSchema>;

export const UpdateEncounterDispositionSchema = z.object({
  status: z.enum([
    ENCOUNTER_STATUSES.FINISHED,
    ENCOUNTER_STATUSES.CANCELLED,
    ENCOUNTER_STATUSES.IN_PROGRESS,
  ]),
  disposition: z
    .object({
      dischargeDestination: z.enum(['HOME', 'TRANSFER_FACILITY', 'ADMITTED', 'EXPIRED', 'AMA']),
      instructions: z.string().optional(),
      dischargedAt: z.string().datetime().optional(),
    })
    .optional(),
});
export type UpdateEncounterDispositionInput = z.infer<typeof UpdateEncounterDispositionSchema>;

export const CreateVitalsSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  recordedAt: z.string().datetime().default(() => new Date().toISOString()),
  bp: z
    .object({
      systolic: z.number().min(30).max(300),
      diastolic: z.number().min(20).max(200),
    })
    .optional(),
  hr: z.number().min(20).max(300).optional(),
  rr: z.number().min(4).max(80).optional(),
  tempC: z.number().min(30).max(45).optional(),
  spo2: z.number().min(40).max(100).optional(),
  weightKg: z.number().min(0.5).max(500).optional(),
  heightCm: z.number().min(20).max(280).optional(),
  painScore: z.number().min(0).max(10).optional(),
  notes: z.string().optional(),
});
export type CreateVitalsInput = z.infer<typeof CreateVitalsSchema>;

export const CreateClinicalNoteSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().min(1),
  template: z.enum([
    CLINICAL_NOTE_TEMPLATES.SOAP,
    CLINICAL_NOTE_TEMPLATES.CONSULTATION,
    CLINICAL_NOTE_TEMPLATES.PROCEDURE_NOTE,
    CLINICAL_NOTE_TEMPLATES.DISCHARGE_SUMMARY,
    CLINICAL_NOTE_TEMPLATES.NURSING_NOTE,
    CLINICAL_NOTE_TEMPLATES.FREE_TEXT,
  ]),
  title: z.string().min(1),
  sections: z.record(z.string()), // e.g. { subjective: "...", objective: "...", assessment: "...", plan: "..." }
});
export type CreateClinicalNoteInput = z.infer<typeof CreateClinicalNoteSchema>;

export const AmendClinicalNoteSchema = z.object({
  amendmentReason: z.string().min(5, 'Amendment reason is required'),
  content: z.string().min(1, 'Amended content is required'),
});
export type AmendClinicalNoteInput = z.infer<typeof AmendClinicalNoteSchema>;

export const CreateProblemSchema = z.object({
  patientId: z.string().min(1),
  icd10: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(['ACTIVE', 'RESOLVED', 'REMISSION', 'INACTIVE']).default('ACTIVE'),
  onset: z.string().optional(),
  resolvedAt: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateProblemInput = z.infer<typeof CreateProblemSchema>;

export const CreateAllergySchema = z.object({
  patientId: z.string().min(1),
  substance: z.string().min(1), // e.g., Penicillin, Peanuts, Latex
  substanceCode: z.string().optional(),
  category: z.enum(['MEDICATION', 'FOOD', 'ENVIRONMENTAL', 'BIOLOGICAL', 'OTHER']).default('MEDICATION'),
  reactions: z.array(z.string()).min(1, 'At least one reaction symptom is required'),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'RESOLVED']).default('ACTIVE'),
  onset: z.string().optional(),
  verificationStatus: z.enum(['CONFIRMED', 'UNCONFIRMED', 'REFUTED']).default('CONFIRMED'),
});
export type CreateAllergyInput = z.infer<typeof CreateAllergySchema>;

export const CreateImmunizationSchema = z.object({
  patientId: z.string().min(1),
  cvx: z.string().min(1),
  vaccineName: z.string().min(1),
  lot: z.string().min(1),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dose: z.string().min(1),
  site: z.enum(['LEFT_DELTOID', 'RIGHT_DELTOID', 'LEFT_THIGH', 'RIGHT_THIGH', 'ORAL', 'NASAL']),
  route: z.enum(['INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRADERMAL', 'ORAL', 'NASAL']),
  administeredAt: z.string().datetime().default(() => new Date().toISOString()),
  notes: z.string().optional(),
});
export type CreateImmunizationInput = z.infer<typeof CreateImmunizationSchema>;
