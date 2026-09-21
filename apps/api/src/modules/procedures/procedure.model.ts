import mongoose, { Schema, Document, Types } from 'mongoose';
import { PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '@ehr/shared';

// Base Procedure Interface
export interface IBaseProcedure extends Document {
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  catalogId?: Types.ObjectId;
  code: string;
  codeSystem: string;
  name: string;
  category: string;
  status: string;
  performedBy: Types.ObjectId[];
  scheduledAt?: Date;
  performedAt?: Date;
  notes?: string;
  outcome?: string;
  consentRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

const baseOptions = {
  discriminatorKey: 'category',
  collection: 'procedures',
  timestamps: true,
};

const BaseProcedureSchema = new Schema<IBaseProcedure>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    catalogId: { type: Schema.Types.ObjectId, ref: 'ProcedureCatalog' },
    code: { type: String, required: true },
    codeSystem: { type: String, default: 'CPT', required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PROCEDURE_STATUSES),
      default: PROCEDURE_STATUSES.PLANNED,
      required: true,
    },
    performedBy: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    scheduledAt: { type: Date },
    performedAt: { type: Date },
    notes: { type: String },
    outcome: { type: String },
    consentRef: { type: String },
  },
  baseOptions
);

BaseProcedureSchema.index({ patientId: 1, performedAt: -1 });

export const ProcedureModel = mongoose.model<IBaseProcedure>('Procedure', BaseProcedureSchema);

// 1. Diagnostic Procedure Discriminator
export const DiagnosticProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.DIAGNOSTIC,
  new Schema({
    indication: { type: String, required: true },
    findings: { type: String, required: true },
    specimenId: { type: String },
  })
);

// 2. Therapeutic / Minor Procedure Discriminator
export const TherapeuticProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.THERAPEUTIC,
  new Schema({
    site: { type: String, required: true },
    technique: { type: String, required: true },
    materials: [{ type: String }],
    anesthesiaLocal: { type: Boolean, default: false },
  })
);

// 3. Surgical Procedure Discriminator
export const SurgicalProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.SURGICAL,
  new Schema({
    surgeonId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assistants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    anesthesiologistId: { type: Schema.Types.ObjectId, ref: 'User' },
    anesthesiaType: {
      type: String,
      enum: ['GENERAL', 'SPINAL', 'EPIDURAL', 'REGIONAL', 'SEDATION', 'LOCAL'],
      required: true,
    },
    preOpDiagnosis: { type: String, required: true },
    postOpDiagnosis: { type: String, required: true },
    asaClass: {
      type: String,
      enum: ['ASA_I', 'ASA_II', 'ASA_III', 'ASA_IV', 'ASA_V', 'ASA_VI', 'ASA_E'],
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    estimatedBloodLossMl: { type: Number, default: 0 },
    implants: [{ type: String }],
    complications: { type: String },
    whoChecklistCompleted: { type: Boolean, default: true },
  })
);

// 4. Imaging Procedure Discriminator
export const ImagingProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.IMAGING,
  new Schema({
    modality: {
      type: String,
      enum: ['XR', 'CT', 'MR', 'US', 'NM', 'PET', 'MAMMO'],
      required: true,
    },
    bodyPart: { type: String, required: true },
    contrastUsed: { type: Boolean, default: false },
    contrastAgent: { type: String },
    radiationDoseMgy: { type: Number },
    studyUid: { type: String },
  })
);

// 5. Laboratory Procedure Discriminator
export const LaboratoryProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.LABORATORY,
  new Schema({
    panelName: { type: String, required: true },
    specimenType: { type: String, required: true },
    collectionTime: { type: Date, default: Date.now },
  })
);

// 6. Immunization Procedure Discriminator
export const ImmunizationProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.IMMUNIZATION,
  new Schema({
    cvx: { type: String, required: true },
    lot: { type: String, required: true },
    expiry: { type: String, required: true },
    site: { type: String, required: true },
    route: { type: String, required: true },
    dose: { type: String, required: true },
  })
);

// 7. Rehabilitative Procedure Discriminator
export const RehabProcedureModel = ProcedureModel.discriminator(
  PROCEDURE_CATEGORIES.REHABILITATIVE,
  new Schema({
    sessionNumber: { type: Number, required: true },
    modality: { type: String, required: true },
    durationMin: { type: Number, required: true },
    patientResponse: { type: String, required: true },
  })
);
