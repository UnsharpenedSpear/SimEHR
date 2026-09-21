import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: {
    given: string[];
    family: string;
    prefix?: string;
  };
  roleIds: Types.ObjectId[];
  facilityIds: Types.ObjectId[];
  departmentIds: Types.ObjectId[];
  mfa: {
    enabled: boolean;
    secretEnc?: string;
    recoveryCodesHash?: string[];
  };
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lockout: {
    count: number;
    until?: Date;
  };
  forcePasswordChange: boolean;
  lastLoginAt?: Date;
  professional?: {
    licenseNo?: string;
    specialty?: string;
    npi?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: {
      given: [{ type: String, required: true }],
      family: { type: String, required: true },
      prefix: { type: String },
    },
    roleIds: [{ type: Schema.Types.ObjectId, ref: 'Role', required: true }],
    facilityIds: [{ type: Schema.Types.ObjectId, ref: 'Facility', required: true }],
    departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String },
      recoveryCodesHash: [{ type: String }],
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    lockout: {
      count: { type: Number, default: 0 },
      until: { type: Date },
    },
    forcePasswordChange: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    professional: {
      licenseNo: { type: String },
      specialty: { type: String },
      npi: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ roleIds: 1 });
UserSchema.index({ facilityIds: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);
