import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDocumentEntity extends Document {
  patientId: Types.ObjectId;
  filename: string;
  mime: string;
  size: number;
  storageRef: string;
  category: 'LAB_REPORT' | 'IMAGING' | 'CLINICAL_SUMMARY' | 'CONSENT' | 'INSURANCE' | 'OTHER';
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentEntity>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    storageRef: { type: String, required: true },
    category: {
      type: String,
      enum: ['LAB_REPORT', 'IMAGING', 'CLINICAL_SUMMARY', 'CONSENT', 'INSURANCE', 'OTHER'],
      default: 'CLINICAL_SUMMARY',
      required: true,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

DocumentSchema.index({ patientId: 1, createdAt: -1 });

export const DocumentModel = mongoose.model<IDocumentEntity>('Document', DocumentSchema);
