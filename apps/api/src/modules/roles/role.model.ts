import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  permissions: string[];
  isSystem: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    permissions: [{ type: String, required: true }],
    isSystem: { type: Boolean, default: false },
    description: { type: String },
  },
  {
    timestamps: true,
  }
);

export const RoleModel = mongoose.model<IRole>('Role', RoleSchema);
