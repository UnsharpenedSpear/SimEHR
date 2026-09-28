import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter {
  _id: string; // e.g. 'mrn:FAC-MAIN'
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 100000 },
  },
  {
    versionKey: false,
  }
);

export const CounterModel = mongoose.model<ICounter>('Counter', CounterSchema);

/**
 * Atomically generate the next sequential MRN for a given facility prefix
 */
export async function getNextMRN(facilityPrefix = 'FAC'): Promise<string> {
  const counterId = `mrn:${facilityPrefix.toUpperCase()}`;
  const counter = await CounterModel.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `${facilityPrefix.toUpperCase()}-${counter.seq}`;
}
