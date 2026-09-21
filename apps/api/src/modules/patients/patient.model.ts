import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPatientIdentifier {
  type: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'INSURANCE_MEMBER_ID' | 'OTHER';
  value: string; // Encrypted in DB
  issuer?: string;
  blindIndex: string; // HMAC-SHA256 for fast indexed search
}

export interface IPatientContact {
  phones: Array<{
    value: string; // Encrypted
    blindIndex: string; // HMAC-SHA256
    isPrimary?: boolean;
  }>;
  email?: {
    value: string; // Encrypted
    blindIndex: string;
  };
}

export interface IPatient extends Document {
  mrn: string;
  facilityId: Types.ObjectId;
  name: {
    given: string[];
    family: string;
    prefix?: string;
    suffix?: string;
  };
  searchName: string; // Normalized: "family given1 given2"
  dob: string; // YYYY-MM-DD
  sex: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  genderIdentity?: string;
  identifiers: IPatientIdentifier[];
  contact: IPatientContact;
  address: {
    street: string; // Encrypted
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    isNextOfKin: boolean;
  }>;
  guardian?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    nationalId?: string;
  };
  insurance: Array<{
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    subscriberName: string;
    relationship: string;
    validUntil?: string;
  }>;
  preferredLanguage: string;
  flags: {
    vip: boolean;
    restricted: boolean;
    deceased: boolean;
  };
  deceasedAt?: Date;
  codeStatus: string;
  isolationFlags: string[];
  careTeam: Array<{
    userId: Types.ObjectId;
    role: string;
    from: Date;
    to?: Date;
  }>;
  status: 'ACTIVE' | 'INACTIVE' | 'MERGED';
  mergedInto?: Types.ObjectId;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    mrn: { type: String, required: true, unique: true, uppercase: true, trim: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true },
    name: {
      given: [{ type: String, required: true }],
      family: { type: String, required: true },
      prefix: { type: String },
      suffix: { type: String },
    },
    searchName: { type: String, required: true, index: true },
    dob: { type: String, required: true, index: true },
    sex: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'], required: true },
    genderIdentity: { type: String },
    identifiers: [
      {
        type: { type: String, required: true },
        value: { type: String, required: true },
        issuer: { type: String },
        blindIndex: { type: String, required: true, index: true },
      },
    ],
    contact: {
      phones: [
        {
          value: { type: String, required: true },
          blindIndex: { type: String, required: true, index: true },
          isPrimary: { type: Boolean, default: false },
        },
      ],
      email: {
        value: { type: String },
        blindIndex: { type: String, index: true, sparse: true },
      },
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: 'USA' },
    },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        phone: { type: String, required: true },
        isNextOfKin: { type: Boolean, default: false },
      },
    ],
    guardian: {
      name: { type: String },
      relationship: { type: String },
      phone: { type: String },
      email: { type: String },
      nationalId: { type: String },
    },
    insurance: [
      {
        provider: { type: String, required: true },
        policyNumber: { type: String, required: true },
        groupNumber: { type: String },
        subscriberName: { type: String, required: true },
        relationship: { type: String, required: true },
        validUntil: { type: String },
      },
    ],
    preferredLanguage: { type: String, default: 'English' },
    flags: {
      vip: { type: Boolean, default: false },
      restricted: { type: Boolean, default: false },
      deceased: { type: Boolean, default: false },
    },
    deceasedAt: { type: Date },
    codeStatus: { type: String, default: 'FULL_CODE' },
    isolationFlags: [{ type: String }],
    careTeam: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String },
        from: { type: Date, default: Date.now },
        to: { type: Date },
      },
    ],
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MERGED'], default: 'ACTIVE' },
    mergedInto: { type: Schema.Types.ObjectId, ref: 'Patient' },
    photoUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound and Performance Indexes
PatientSchema.index({ facilityId: 1, searchName: 1 });
PatientSchema.index({ facilityId: 1, dob: 1 });
PatientSchema.index({ facilityId: 1, status: 1 });
PatientSchema.index({ 'identifiers.type': 1, 'identifiers.blindIndex': 1 });
PatientSchema.index({ 'contact.phones.blindIndex': 1 });

export const PatientModel = mongoose.model<IPatient>('Patient', PatientSchema);
