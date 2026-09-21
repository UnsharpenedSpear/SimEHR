import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IImagingReport extends Document {
  orderId: Types.ObjectId;
  patientId: Types.ObjectId;
  modality: 'XR' | 'CT' | 'MR' | 'US' | 'NM' | 'PET' | 'MAMMO';
  accessionNumber: string;
  studyUid?: string;
  findings: string;
  impression: string;
  recommendations?: string;
  isCritical: boolean;
  status: 'DRAFT' | 'PRELIMINARY' | 'FINAL' | 'ADDENDUM';
  radiologistId: Types.ObjectId;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImagingReportSchema = new Schema<IImagingReport>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    modality: {
      type: String,
      enum: ['XR', 'CT', 'MR', 'US', 'NM', 'PET', 'MAMMO'],
      required: true,
      index: true,
    },
    accessionNumber: { type: String, required: true, unique: true },
    studyUid: { type: String },
    findings: { type: String, required: true },
    impression: { type: String, required: true },
    recommendations: { type: String },
    isCritical: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PRELIMINARY', 'FINAL', 'ADDENDUM'],
      default: 'FINAL',
      index: true,
    },
    radiologistId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

ImagingReportSchema.index({ patientId: 1, createdAt: -1 });

export const ImagingReportModel = mongoose.model<IImagingReport>('ImagingReport', ImagingReportSchema);
