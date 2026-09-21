import mongoose, { Schema, Document, Types } from 'mongoose';
import { ORDER_PRIORITIES, ORDER_STATUSES, ORDER_TYPES } from '@ehr/shared';

export interface IOrder extends Document {
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  type: string;
  catalogCode?: string;
  name: string;
  priority: string;
  status: string;
  indication: string;
  orderedBy: Types.ObjectId;
  destinationDeptId: Types.ObjectId;
  details: Record<string, unknown>;
  signedAt?: Date;
  isControlledSubstance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    type: {
      type: String,
      enum: Object.values(ORDER_TYPES),
      required: true,
      index: true,
    },
    catalogCode: { type: String },
    name: { type: String, required: true },
    priority: {
      type: String,
      enum: Object.values(ORDER_PRIORITIES),
      default: ORDER_PRIORITIES.ROUTINE,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.ORDERED,
      required: true,
      index: true,
    },
    indication: { type: String, required: true },
    orderedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    destinationDeptId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    signedAt: { type: Date },
    isControlledSubstance: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

OrderSchema.index({ patientId: 1, createdAt: -1 });
OrderSchema.index({ destinationDeptId: 1, status: 1, priority: 1, createdAt: 1 });

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
