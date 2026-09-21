import mongoose from 'mongoose';
import { VitalsModel } from '../../modules/vitals/vitals.model.js';

export async function getVitalsTrend(patientId: string, limit = 30) {
  const patientObjId = new mongoose.Types.ObjectId(patientId);

  const vitals = await VitalsModel.find({ patientId: patientObjId })
    .sort({ recordedAt: 1 }) // Chronological order for trend charts
    .limit(limit)
    .lean();

  return vitals.map((v) => ({
    id: v._id.toString(),
    recordedAt: v.recordedAt,
    dateLabel: new Date(v.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    systolic: v.bp?.systolic,
    diastolic: v.bp?.diastolic,
    hr: v.hr,
    rr: v.rr,
    tempC: v.tempC,
    spo2: v.spo2,
    weightKg: v.weightKg,
    bmi: v.bmi,
    abnormalFlags: v.abnormalFlags,
  }));
}
