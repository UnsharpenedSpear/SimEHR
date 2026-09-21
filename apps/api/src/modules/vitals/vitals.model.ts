import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVitals extends Document {
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  recordedAt: Date;
  recordedBy: Types.ObjectId;
  bp?: {
    systolic: number;
    diastolic: number;
  };
  hr?: number;
  rr?: number;
  tempC?: number;
  spo2?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  painScore?: number;
  abnormalFlags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function calculateBMI(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm || heightCm <= 0) return undefined;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function evaluateVitalsFlags(v: {
  bp?: { systolic: number; diastolic: number };
  hr?: number;
  rr?: number;
  tempC?: number;
  spo2?: number;
}): string[] {
  const flags: string[] = [];

  if (v.bp) {
    if (v.bp.systolic >= 180 || v.bp.diastolic >= 120) {
      flags.push('HYPERTENSIVE_CRISIS');
    } else if (v.bp.systolic >= 140 || v.bp.diastolic >= 90) {
      flags.push('HYPERTENSION_STAGE_2');
    } else if (v.bp.systolic < 90 || v.bp.diastolic < 60) {
      flags.push('HYPOTENSION');
    }
  }

  if (v.hr) {
    if (v.hr > 100) flags.push('TACHYCARDIA');
    if (v.hr < 60) flags.push('BRADYCARDIA');
  }

  if (v.spo2) {
    if (v.spo2 < 90) flags.push('HYPOXIA_CRITICAL');
    else if (v.spo2 < 95) flags.push('HYPOXIA_MILD');
  }

  if (v.tempC) {
    if (v.tempC >= 38.5) flags.push('FEVER_HIGH');
    else if (v.tempC >= 37.8) flags.push('FEVER_LOW');
    else if (v.tempC < 35.0) flags.push('HYPOTHERMIA');
  }

  return flags;
}

const VitalsSchema = new Schema<IVitals>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    recordedAt: { type: Date, default: Date.now, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bp: {
      systolic: { type: Number },
      diastolic: { type: Number },
    },
    hr: { type: Number },
    rr: { type: Number },
    tempC: { type: Number },
    spo2: { type: Number },
    weightKg: { type: Number },
    heightCm: { type: Number },
    bmi: { type: Number },
    painScore: { type: Number },
    abnormalFlags: [{ type: String }],
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

VitalsSchema.index({ patientId: 1, recordedAt: -1 });

export const VitalsModel = mongoose.model<IVitals>('Vitals', VitalsSchema);
