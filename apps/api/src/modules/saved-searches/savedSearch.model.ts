import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISavedSearch extends Document {
  userId: Types.ObjectId;
  name: string;
  entity: string;
  filters: Record<string, unknown>;
  sort?: string;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SavedSearchSchema = new Schema<ISavedSearch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    entity: { type: String, required: true },
    filters: { type: Schema.Types.Mixed, required: true },
    sort: { type: String },
    isShared: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

SavedSearchSchema.index({ userId: 1, entity: 1 });

export const SavedSearchModel = mongoose.model<ISavedSearch>('SavedSearch', SavedSearchSchema);
