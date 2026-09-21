import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILabResult extends Document {
  orderId: Types.ObjectId;
  patientId: Types.ObjectId;
  analyteCode: string; // LOINC
  analyteName: string;
  value: string | number;
  numericValue?: number;
  unit: string;
  referenceRange: {
    low?: number;
    high?: number;
    criticalLow?: number;
    criticalHigh?: number;
  };
  flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
  status: 'PRELIMINARY' | 'FINAL' | 'AMENDED' | 'CORRECTED';
  notes?: string;
  recordedBy: Types.ObjectId;
  verifiedBy?: Types.ObjectId;
  criticalAlertDispatched: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function evaluateLabFlag(
  numericVal: number | undefined,
  ref: { low?: number; high?: number; criticalLow?: number; criticalHigh?: number }
): 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' {
  if (numericVal === undefined || isNaN(numericVal)) return 'NORMAL';
  if (ref.criticalLow !== undefined && numericVal <= ref.criticalLow) return 'CRITICAL_LOW';
  if (ref.criticalHigh !== undefined && numericVal >= ref.criticalHigh) return 'CRITICAL_HIGH';
  if (ref.low !== undefined && numericVal < ref.low) return 'LOW';
  if (ref.high !== undefined && numericVal > ref.high) return 'HIGH';
  return 'NORMAL';
}

const LabResultSchema = new Schema<ILabResult>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    analyteCode: { type: String, required: true },
    analyteName: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    numericValue: { type: Number },
    unit: { type: String, required: true },
    referenceRange: {
      low: { type: Number },
      high: { type: Number },
      criticalLow: { type: Number },
      criticalHigh: { type: Number },
    },
    flag: {
      type: String,
      enum: ['NORMAL', 'HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW'],
      default: 'NORMAL',
      index: true,
    },
    status: {
      type: String,
      enum: ['PRELIMINARY', 'FINAL', 'AMENDED', 'CORRECTED'],
      default: 'FINAL',
      index: true,
    },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    criticalAlertDispatched: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

LabResultSchema.index({ patientId: 1, createdAt: -1 });

export const LabResultModel = mongoose.model<ILabResult>('LabResult', LabResultSchema);
