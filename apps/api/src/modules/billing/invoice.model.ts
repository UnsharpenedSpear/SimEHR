import mongoose, { Schema, Document, Types } from 'mongoose';
import { INVOICE_STATUSES, InvoiceStatus } from '@ehr/shared';
import { CounterModel } from '../patients/counter.model.js';

export interface IInvoiceItem {
  procedureId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IPayment {
  amount: number;
  method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'INSURANCE_CLAIM' | 'CHECK' | 'ELECTRONIC_TRANSFER';
  referenceNumber?: string;
  notes?: string;
  recordedAt: Date;
  recordedBy: Types.ObjectId;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  patientId: Types.ObjectId;
  encounterId: Types.ObjectId;
  facilityId: Types.ObjectId;
  status: InvoiceStatus;
  lineItems: IInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  payer: {
    type: 'SELF_PAY' | 'INSURANCE' | 'MEDICARE' | 'MEDICAID' | 'THIRD_PARTY';
    insuranceId?: string;
    policyNumber?: string;
  };
  payments: IPayment[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getNextInvoiceNumber(facilityPrefix = 'FAC'): Promise<string> {
  const year = new Date().getFullYear();
  const counterName = `invoice_${facilityPrefix}_${year}`;
  const counter = await CounterModel.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const sequenceStr = counter.seq.toString().padStart(6, '0');
  return `INV-${facilityPrefix}-${year}-${sequenceStr}`;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    code: { type: String, required: true },
    description: { type: String, required: true },
    quantity: { type: Number, default: 1, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'INSURANCE_CLAIM', 'CHECK', 'ELECTRONIC_TRANSFER'],
      required: true,
    },
    referenceNumber: { type: String },
    notes: { type: String },
    recordedAt: { type: Date, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', required: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.ISSUED,
      required: true,
      index: true,
    },
    lineItems: [InvoiceItemSchema],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, required: true },
    payer: {
      type: {
        type: String,
        enum: ['SELF_PAY', 'INSURANCE', 'MEDICARE', 'MEDICAID', 'THIRD_PARTY'],
        default: 'SELF_PAY',
      },
      insuranceId: { type: String },
      policyNumber: { type: String },
    },
    payments: [PaymentSchema],
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

InvoiceSchema.index({ patientId: 1, status: 1 });

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
