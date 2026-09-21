import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IImmunization extends Document {
  patientId: Types.ObjectId;
  cvx: string;
  vaccineName: string;
  lot: string;
  expiry: string;
  dose: string;
  site: string;
  route: string;
  administeredBy: Types.ObjectId;
  administeredAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImmunizationSchema = new Schema<IImmunization>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    cvx: { type: String, required: true },
    vaccineName: { type: String, required: true },
    lot: { type: String, required: true },
    expiry: { type: String, required: true },
    dose: { type: String, required: true },
    site: { type: String, required: true },
    route: { type: String, required: true },
    administeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    administeredAt: { type: Date, default: Date.now, required: true },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

ImmunizationSchema.index({ patientId: 1, administeredAt: -1 });

export const ImmunizationModel = mongoose.model<IImmunization>('Immunization', ImmunizationSchema);
