import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDepartment extends Document {
  facilityId: Types.ObjectId;
  code: string;
  name: string;
  type: string;
  location?: {
    building?: string;
    floor?: string;
    room?: string;
  };
  phone?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        'EMERGENCY',
        'ICU',
        'GENERAL_WARD',
        'SURGERY_OT',
        'LABORATORY',
        'RADIOLOGY',
        'PHARMACY',
        'OUTPATIENT_CLINIC',
        'ADMINISTRATION',
      ],
      required: true,
      index: true,
    },
    location: {
      building: { type: String },
      floor: { type: String },
      room: { type: String },
    },
    phone: { type: String },
    active: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

DepartmentSchema.index({ facilityId: 1, code: 1 }, { unique: true });

export const DepartmentModel = mongoose.model<IDepartment>('Department', DepartmentSchema);
