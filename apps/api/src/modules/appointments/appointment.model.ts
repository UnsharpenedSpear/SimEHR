import mongoose, { Schema, Document, Types } from 'mongoose';
import { APPOINTMENT_STATUSES, AppointmentStatus } from '@ehr/shared';

export interface IAppointment extends Document {
  patientId: Types.ObjectId;
  providerId: Types.ObjectId;
  facilityId: Types.ObjectId;
  departmentId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  type: 'ROUTINE' | 'FOLLOW_UP' | 'NEW_PATIENT' | 'URGENT' | 'PROCEDURE' | 'TELEHEALTH';
  status: AppointmentStatus;
  start: Date;
  end: Date;
  durationMin: number;
  reason: string;
  room?: string;
  notes?: string;
  cancellationReason?: string;
  checkedInAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    type: {
      type: String,
      enum: ['ROUTINE', 'FOLLOW_UP', 'NEW_PATIENT', 'URGENT', 'PROCEDURE', 'TELEHEALTH'],
      default: 'ROUTINE',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUSES),
      default: APPOINTMENT_STATUSES.CONFIRMED,
      required: true,
      index: true,
    },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true, index: true },
    durationMin: { type: Number, required: true },
    reason: { type: String, required: true },
    room: { type: String },
    notes: { type: String },
    cancellationReason: { type: String },
    checkedInAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

AppointmentSchema.index({ providerId: 1, start: 1, end: 1, status: 1 });
AppointmentSchema.index({ facilityId: 1, departmentId: 1, start: 1 });

export const AppointmentModel = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
