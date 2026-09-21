import mongoose, { Schema, Document } from 'mongoose';
import { PROCEDURE_CATEGORIES } from '@ehr/shared';

export interface IProcedureCatalog extends Document {
  code: string;
  codeSystem: string;
  name: string;
  category: string;
  defaultDurationMin: number;
  requiredPermission: string;
  price: number;
  active: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProcedureCatalogSchema = new Schema<IProcedureCatalog>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    codeSystem: { type: String, default: 'CPT', required: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: Object.values(PROCEDURE_CATEGORIES),
      required: true,
      index: true,
    },
    defaultDurationMin: { type: Number, default: 30 },
    requiredPermission: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true, index: true },
    description: { type: String },
  },
  {
    timestamps: true,
  }
);

ProcedureCatalogSchema.index({ category: 1, active: 1 });

export const ProcedureCatalogModel = mongoose.model<IProcedureCatalog>('ProcedureCatalog', ProcedureCatalogSchema);
