import mongoose, { Schema, Document, Types } from 'mongoose';
import { ENCOUNTER_STATUSES, ENCOUNTER_TYPES } from '@ehr/shared';

export interface IEncounter extends Document {
  patientId: Types.ObjectId;
  facilityId: Types.ObjectId;
  type: string;
  status: string;
  departmentId: Types.ObjectId;
  attendingId: Types.ObjectId;
  start: Date;
  end?: Date;
  reasonForVisit: string;
  diagnoses: Array<{
    code: string;
    system: string;
    display: string;
    rank: number;
    isPrimary: boolean;
  }>;
  disposition?: {
    dischargeDestination: 'HOME' | 'TRANSFER_FACILITY' | 'ADMITTED' | 'EXPIRED' | 'AMA';
    instructions?: string;
    dischargedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const EncounterSchema = new Schema<IEncounter>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(ENCOUNTER_TYPES),
      default: ENCOUNTER_TYPES.OUTPATIENT,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ENCOUNTER_STATUSES),
      default: ENCOUNTER_STATUSES.IN_PROGRESS,
      required: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    attendingId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    start: { type: Date, default: Date.now, required: true },
    end: { type: Date },
    reasonForVisit: { type: String, required: true },
    diagnoses: [
      {
        code: { type: String, required: true },
        system: { type: String, default: 'http://hl7.org/fhir/sid/icd-10' },
        display: { type: String, required: true },
        rank: { type: Number, default: 1 },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    disposition: {
      dischargeDestination: { type: String, enum: ['HOME', 'TRANSFER_FACILITY', 'ADMITTED', 'EXPIRED', 'AMA'] },
      instructions: { type: String },
      dischargedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

EncounterSchema.index({ patientId: 1, start: -1 });
EncounterSchema.index({ attendingId: 1, status: 1, start: -1 });

export const EncounterModel = mongoose.model<IEncounter>('Encounter', EncounterSchema);
