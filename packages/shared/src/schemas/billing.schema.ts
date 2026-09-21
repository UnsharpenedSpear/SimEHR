import { z } from 'zod';
import { INVOICE_STATUSES } from '../constants/status.js';

export const InvoiceLineItemSchema = z
  .object({
    procedureId: z.string().optional(),
    orderId: z.string().optional(),
    code: z.string().min(1),
    description: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
  })
  .passthrough();
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export const CreateInvoiceSchema = z
  .object({
    patientId: z.string().min(1),
    encounterId: z.string().min(1),
    facilityId: z.string().min(1),
    lineItems: z.array(InvoiceLineItemSchema).min(1, 'At least one line item is required'),
    payer: z
      .object({
        type: z.enum(['SELF_PAY', 'INSURANCE', 'MEDICARE', 'MEDICAID', 'THIRD_PARTY']),
        insuranceId: z.string().optional(),
        policyNumber: z.string().optional(),
      })
      .passthrough(),
    notes: z.string().optional(),
  })
  .passthrough();
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const RecordPaymentSchema = z
  .object({
    amount: z.number().min(0.01),
    method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'INSURANCE_CLAIM', 'CHECK', 'ELECTRONIC_TRANSFER']),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
