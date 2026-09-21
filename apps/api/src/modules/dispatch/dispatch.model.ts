import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  DISPATCH_STATUSES,
  DISPATCH_TYPES,
  ORDER_PRIORITIES,
  DispatchStatus,
  DispatchType,
  OrderPriority,
} from '@ehr/shared';

export interface IDispatchEvent {
  fromStatus: string;
  toStatus: string;
  timestamp: Date;
  actorId: Types.ObjectId;
  reason?: string;
  location?: string;
  meta?: Record<string, unknown>;
}

export interface IDispatch extends Document {
  orderId: Types.ObjectId;
  patientId: Types.ObjectId;
  facilityId: Types.ObjectId;
  type: DispatchType;
  status: DispatchStatus;
  priority: OrderPriority;
  fromDeptId: Types.ObjectId;
  toDeptId: Types.ObjectId;
  assignedStaffId?: Types.ObjectId;
  notes?: string;
  slaMinutes: number;
  slaDueAt: Date;
  isBreached: boolean;
  events: IDispatchEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export const VALID_DISPATCH_TRANSITIONS: Record<string, string[]> = {
  [DISPATCH_STATUSES.CREATED]: [DISPATCH_STATUSES.DISPATCHED, DISPATCH_STATUSES.CANCELLED],
  [DISPATCH_STATUSES.DISPATCHED]: [
    DISPATCH_STATUSES.ACKNOWLEDGED,
    DISPATCH_STATUSES.REJECTED,
    DISPATCH_STATUSES.CANCELLED,
  ],
  [DISPATCH_STATUSES.ACKNOWLEDGED]: [
    DISPATCH_STATUSES.IN_PROGRESS,
    DISPATCH_STATUSES.REJECTED,
    DISPATCH_STATUSES.CANCELLED,
  ],
  [DISPATCH_STATUSES.IN_PROGRESS]: [
    DISPATCH_STATUSES.COMPLETED,
    DISPATCH_STATUSES.ON_HOLD,
    DISPATCH_STATUSES.CANCELLED,
  ],
  [DISPATCH_STATUSES.ON_HOLD]: [DISPATCH_STATUSES.IN_PROGRESS, DISPATCH_STATUSES.CANCELLED],
  [DISPATCH_STATUSES.COMPLETED]: [],
  [DISPATCH_STATUSES.REJECTED]: [],
  [DISPATCH_STATUSES.CANCELLED]: [],
};

export function getDefaultSlaMinutes(priority: OrderPriority): number {
  switch (priority) {
    case ORDER_PRIORITIES.STAT:
      return 20;
    case ORDER_PRIORITIES.URGENT:
      return 60;
    case ORDER_PRIORITIES.ROUTINE:
    default:
      return 240;
  }
}

const DispatchEventSchema = new Schema<IDispatchEvent>(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String },
    location: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const DispatchSchema = new Schema<IDispatch>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(DISPATCH_TYPES),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(DISPATCH_STATUSES),
      default: DISPATCH_STATUSES.CREATED,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(ORDER_PRIORITIES),
      default: ORDER_PRIORITIES.ROUTINE,
      required: true,
      index: true,
    },
    fromDeptId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    toDeptId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    notes: { type: String },
    slaMinutes: { type: Number, required: true },
    slaDueAt: { type: Date, required: true, index: true },
    isBreached: { type: Boolean, default: false, index: true },
    events: [DispatchEventSchema],
  },
  {
    timestamps: true,
  }
);

DispatchSchema.index({ toDeptId: 1, status: 1, priority: 1, slaDueAt: 1 });
DispatchSchema.index({ facilityId: 1, isBreached: 1, status: 1 });

export const DispatchModel = mongoose.model<IDispatch>('Dispatch', DispatchSchema);
