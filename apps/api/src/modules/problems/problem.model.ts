import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProblem extends Document {
  patientId: Types.ObjectId;
  icd10: string;
  description: string;
  status: 'ACTIVE' | 'RESOLVED' | 'REMISSION' | 'INACTIVE';
  onset?: string;
  resolvedAt?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProblemSchema = new Schema<IProblem>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    icd10: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'REMISSION', 'INACTIVE'],
      default: 'ACTIVE',
      required: true,
    },
    onset: { type: String },
    resolvedAt: { type: String },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

ProblemSchema.index({ patientId: 1, status: 1 });

export const ProblemModel = mongoose.model<IProblem>('Problem', ProblemSchema);
