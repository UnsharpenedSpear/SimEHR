import mongoose, { Schema, Document, Types } from 'mongoose';
import { CLINICAL_NOTE_STATUSES, CLINICAL_NOTE_TEMPLATES } from '@ehr/shared';

export interface IClinicalNote extends Document {
  patientId: Types.ObjectId;
  encounterId: Types.ObjectId;
  template: string;
  title: string;
  content: Record<string, string>; // e.g. { subjective, objective, assessment, plan }
  status: string;
  authorId: Types.ObjectId;
  signedBy?: Types.ObjectId;
  signedAt?: Date;
  version: number;
  previousVersionId?: Types.ObjectId;
  amendmentReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicalNoteSchema = new Schema<IClinicalNote>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true, index: true },
    template: {
      type: String,
      enum: Object.values(CLINICAL_NOTE_TEMPLATES),
      default: CLINICAL_NOTE_TEMPLATES.SOAP,
      required: true,
    },
    title: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: Object.values(CLINICAL_NOTE_STATUSES),
      default: CLINICAL_NOTE_STATUSES.DRAFT,
      required: true,
    },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    signedAt: { type: Date },
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: 'ClinicalNote' },
    amendmentReason: { type: String },
  },
  {
    timestamps: true,
  }
);

ClinicalNoteSchema.index({ patientId: 1, createdAt: -1 });
ClinicalNoteSchema.index({ encounterId: 1 });

export const ClinicalNoteModel = mongoose.model<IClinicalNote>('ClinicalNote', ClinicalNoteSchema);
