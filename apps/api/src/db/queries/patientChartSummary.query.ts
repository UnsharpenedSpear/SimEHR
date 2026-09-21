import mongoose from 'mongoose';
import { PatientModel } from '../../modules/patients/patient.model.js';
import { AllergyModel } from '../../modules/allergies/allergy.model.js';
import { ProblemModel } from '../../modules/problems/problem.model.js';
import { VitalsModel } from '../../modules/vitals/vitals.model.js';
import { EncounterModel } from '../../modules/encounters/encounter.model.js';
import { decryptField } from '../../utils/crypto.util.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export async function getPatientChartSummary(patientId: string) {
  const patientObjId = new mongoose.Types.ObjectId(patientId);

  const [patient, allergies, problems, lastVitals, recentEncounters] = await Promise.all([
    PatientModel.findById(patientObjId).lean(),
    AllergyModel.find({ patientId: patientObjId, status: 'ACTIVE' }).lean(),
    ProblemModel.find({ patientId: patientObjId, status: 'ACTIVE' }).lean(),
    VitalsModel.findOne({ patientId: patientObjId }).sort({ recordedAt: -1 }).lean(),
    EncounterModel.find({ patientId: patientObjId })
      .populate('attendingId', 'name professional')
      .sort({ start: -1 })
      .limit(5)
      .lean(),
  ]);

  if (!patient) {
    throw new NotFoundError('Patient record not found');
  }

  // Decrypt patient banner fields
  const banner = {
    id: patient._id.toString(),
    mrn: patient.mrn,
    name: patient.name,
    dob: patient.dob,
    sex: patient.sex,
    codeStatus: patient.codeStatus,
    isolationFlags: patient.isolationFlags,
    flags: patient.flags,
    allergies: allergies.map((a) => ({ substance: a.substance, severity: a.severity })),
    lastVitals: lastVitals
      ? {
          bp: lastVitals.bp,
          hr: lastVitals.hr,
          spo2: lastVitals.spo2,
          tempC: lastVitals.tempC,
          recordedAt: lastVitals.recordedAt,
        }
      : undefined,
  };

  return {
    banner,
    allergies,
    problems,
    lastVitals,
    recentEncounters,
  };
}
