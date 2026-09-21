import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPrescription extends Document {
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  drug: {
    code: string; // RxNorm
    name: string;
    strength: string;
    form: string;
  };
  dosage: {
    dose: string;
    unit: string;
    route: string;
    frequency: string;
  };
  durationDays: number;
  quantity: number;
  refills: number;
  instructions: string;
  isControlled: boolean;
  status: 'ACTIVE' | 'VERIFIED' | 'DISPENSED' | 'CANCELLED';
  prescribedBy: Types.ObjectId;
  verifiedBy?: Types.ObjectId;
  dispensedBy?: Types.ObjectId;
  interactionWarnings: Array<{
    type: 'DRUG_DRUG' | 'DRUG_ALLERGY';
    severity: 'MAJOR' | 'MODERATE' | 'MINOR';
    description: string;
  }>;
  overrideWarningReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionSchema = new Schema<IPrescription>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    drug: {
      code: { type: String, required: true },
      name: { type: String, required: true },
      strength: { type: String, required: true },
      form: { type: String, required: true },
    },
    dosage: {
      dose: { type: String, required: true },
      unit: { type: String, required: true },
      route: { type: String, required: true },
      frequency: { type: String, required: true },
    },
    durationDays: { type: Number, required: true },
    quantity: { type: Number, required: true },
    refills: { type: Number, default: 0 },
    instructions: { type: String, required: true },
    isControlled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['ACTIVE', 'VERIFIED', 'DISPENSED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    prescribedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dispensedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    interactionWarnings: [
      {
        type: { type: String, enum: ['DRUG_DRUG', 'DRUG_ALLERGY'] },
        severity: { type: String, enum: ['MAJOR', 'MODERATE', 'MINOR'] },
        description: { type: String },
      },
    ],
    overrideWarningReason: { type: String },
  },
  {
    timestamps: true,
  }
);

PrescriptionSchema.index({ patientId: 1, status: 1 });

export const PrescriptionModel = mongoose.model<IPrescription>('Prescription', PrescriptionSchema);
