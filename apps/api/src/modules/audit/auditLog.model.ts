import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  seq: number;
  prevHash: string;
  hash: string;
  actorId: Types.ObjectId | string;
  action: string;
  resourceType: string;
  resourceId?: string;
  patientId?: Types.ObjectId;
  facilityId?: Types.ObjectId;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ip?: string;
  userAgent?: string;
  requestId?: string;
  diff?: Record<string, unknown>;
  breakGlass?: {
    reason: string;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
  };
  at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    seq: { type: Number, required: true, unique: true },
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
    actorId: { type: Schema.Types.Mixed, required: true },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    outcome: { type: String, enum: ['SUCCESS', 'FAILURE', 'DENIED'], default: 'SUCCESS' },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    diff: { type: Schema.Types.Mixed },
    breakGlass: {
      reason: { type: String },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
    },
    at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

AuditLogSchema.index({ seq: -1 }, { unique: true });
AuditLogSchema.index({ patientId: 1, at: -1 });
AuditLogSchema.index({ actorId: 1, at: -1 });
AuditLogSchema.index({ action: 1, at: -1 });
AuditLogSchema.index({ 'breakGlass.reason': 1 }, { sparse: true });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
