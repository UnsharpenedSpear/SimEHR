import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAllergy extends Document {
  patientId: Types.ObjectId;
  substance: string;
  substanceCode?: string;
  category: 'MEDICATION' | 'FOOD' | 'ENVIRONMENTAL' | 'BIOLOGICAL' | 'OTHER';
  reactions: string[];
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  status: 'ACTIVE' | 'INACTIVE' | 'RESOLVED';
  verificationStatus: 'CONFIRMED' | 'UNCONFIRMED' | 'REFUTED';
  onset?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AllergySchema = new Schema<IAllergy>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    substance: { type: String, required: true },
    substanceCode: { type: String },
    category: {
      type: String,
      enum: ['MEDICATION', 'FOOD', 'ENVIRONMENTAL', 'BIOLOGICAL', 'OTHER'],
      default: 'MEDICATION',
      required: true,
    },
    reactions: [{ type: String, required: true }],
    severity: {
      type: String,
      enum: ['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'RESOLVED'],
      default: 'ACTIVE',
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: ['CONFIRMED', 'UNCONFIRMED', 'REFUTED'],
      default: 'CONFIRMED',
      required: true,
    },
    onset: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

AllergySchema.index({ patientId: 1, status: 1 });

export const AllergyModel = mongoose.model<IAllergy>('Allergy', AllergySchema);
