import { Request, Response, NextFunction } from 'express';
import { PatientModel } from '../patients/patient.model.js';
import { EncounterModel } from '../encounters/encounter.model.js';
import { VitalsModel } from '../vitals/vitals.model.js';
import { LabResultModel } from '../diagnostics/labResult.model.js';
import { ProblemModel } from '../problems/problem.model.js';
import { AllergyModel } from '../allergies/allergy.model.js';
import { PrescriptionModel } from '../prescriptions/prescription.model.js';
import { ProcedureModel } from '../procedures/procedure.model.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

export class FhirController {
  // --- FHIR R4 Patient ---
  static async getPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patient = await PatientModel.findById(req.params.id).lean();
      if (!patient) throw new NotFoundError('FHIR Patient not found');

      const fhirResource = {
        resourceType: 'Patient',
        id: patient._id.toString(),
        meta: {
          versionId: '1',
          lastUpdated: patient.updatedAt?.toISOString() || new Date().toISOString(),
        },
        identifier: [
          {
            use: 'usual',
            type: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }],
              text: 'Medical Record Number',
            },
            system: 'urn:oid:1.2.840.114350',
            value: patient.mrn,
          },
        ],
        active: patient.status === 'ACTIVE',
        name: [
          {
            use: 'official',
            family: patient.name.family,
            given: patient.name.given,
          },
        ],
        gender: patient.sex.toLowerCase() === 'female' ? 'female' : 'male',
        birthDate: patient.dob,
        deceasedBoolean: patient.flags?.deceased || false,
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(fhirResource);
    } catch (err) {
      next(err);
    }
  }

  static async searchPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filter: Record<string, unknown> = { status: 'ACTIVE' };
      if (req.query.identifier) filter.mrn = req.query.identifier;
      if (req.query.gender) filter.sex = (req.query.gender as string).toUpperCase();

      const patients = await PatientModel.find(filter).limit(50).lean();

      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: patients.length,
        entry: patients.map((p) => ({
          fullUrl: `${req.protocol}://${req.get('host')}/fhir/Patient/${p._id}`,
          resource: {
            resourceType: 'Patient',
            id: p._id.toString(),
            identifier: [{ system: 'urn:mrn', value: p.mrn }],
            name: [{ family: p.name.family, given: p.name.given }],
            gender: p.sex.toLowerCase() === 'female' ? 'female' : 'male',
            birthDate: p.dob,
          },
        })),
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // --- FHIR R4 Encounter ---
  static async getEncounter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const enc = await EncounterModel.findById(req.params.id).lean();
      if (!enc) throw new NotFoundError('FHIR Encounter not found');

      const fhirResource = {
        resourceType: 'Encounter',
        id: enc._id.toString(),
        status: enc.status === 'COMPLETED' ? 'finished' : 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: enc.type === 'INPATIENT' ? 'IMP' : enc.type === 'EMERGENCY' ? 'EMER' : 'AMB',
          display: enc.type,
        },
        subject: {
          reference: `Patient/${enc.patientId.toString()}`,
        },
        period: {
          start: enc.start?.toISOString() || (enc as any).period?.start?.toISOString() || new Date().toISOString(),
          end: enc.end?.toISOString() || (enc as any).period?.end?.toISOString(),
        },
        reasonCode: (enc.reasonForVisit || (enc as any).reason) ? [{ text: enc.reasonForVisit || (enc as any).reason }] : undefined,
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(fhirResource);
    } catch (err) {
      next(err);
    }
  }

  // --- FHIR R4 Observation (Vitals / Labs) ---
  static async getObservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // First check lab result, then vitals
      const lab = await LabResultModel.findById(req.params.id).lean();
      if (lab) {
        const fhirResource = {
          resourceType: 'Observation',
          id: lab._id.toString(),
          status: lab.status.toLowerCase(),
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: lab.analyteCode,
                display: lab.analyteName,
              },
            ],
            text: lab.analyteName,
          },
          subject: {
            reference: `Patient/${lab.patientId.toString()}`,
          },
          effectiveDateTime: lab.createdAt.toISOString(),
          valueQuantity:
            lab.numericValue !== undefined
              ? {
                  value: lab.numericValue,
                  unit: lab.unit,
                  system: 'http://unitsofmeasure.org',
                }
              : undefined,
          valueString: lab.numericValue === undefined ? String(lab.value) : undefined,
          interpretation: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                  code: lab.flag,
                },
              ],
            },
          ],
        };

        res.setHeader('Content-Type', 'application/fhir+json');
        res.status(200).json(fhirResource);
        return;
      }

      const vitals = await VitalsModel.findById(req.params.id).lean();
      if (vitals) {
        const fhirResource = {
          resourceType: 'Observation',
          id: vitals._id.toString(),
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                },
              ],
            },
          ],
          subject: {
            reference: `Patient/${vitals.patientId.toString()}`,
          },
          effectiveDateTime: vitals.recordedAt.toISOString(),
          component: [
            vitals.bp
              ? {
                  code: { text: 'Systolic Blood Pressure' },
                  valueQuantity: { value: vitals.bp.systolic, unit: 'mmHg' },
                }
              : null,
            vitals.hr
              ? {
                  code: { text: 'Heart Rate' },
                  valueQuantity: { value: vitals.hr, unit: 'beats/min' },
                }
              : null,
            vitals.spo2
              ? {
                  code: { text: 'Oxygen Saturation' },
                  valueQuantity: { value: vitals.spo2, unit: '%' },
                }
              : null,
          ].filter(Boolean),
        };

        res.setHeader('Content-Type', 'application/fhir+json');
        res.status(200).json(fhirResource);
        return;
      }

      throw new NotFoundError('FHIR Observation not found');
    } catch (err) {
      next(err);
    }
  }

  // --- FHIR R4 Condition (Problem) ---
  static async getCondition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const problem = await ProblemModel.findById(req.params.id).lean();
      if (!problem) throw new NotFoundError('FHIR Condition not found');

      const fhirResource = {
        resourceType: 'Condition',
        id: problem._id.toString(),
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: problem.status.toLowerCase(),
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: (problem as any).verificationStatus?.toLowerCase() || 'confirmed',
            },
          ],
        },
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10-cm',
              code: problem.icd10 || (problem as any).icd10Code,
              display: problem.description || (problem as any).name,
            },
          ],
          text: problem.description || (problem as any).name,
        },
        subject: {
          reference: `Patient/${problem.patientId.toString()}`,
        },
        onsetDateTime: problem.onset || (problem as any).onsetDate,
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(fhirResource);
    } catch (err) {
      next(err);
    }
  }

  // --- FHIR R4 AllergyIntolerance ---
  static async getAllergyIntolerance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allergy = await AllergyModel.findById(req.params.id).lean();
      if (!allergy) throw new NotFoundError('FHIR AllergyIntolerance not found');

      const fhirResource = {
        resourceType: 'AllergyIntolerance',
        id: allergy._id.toString(),
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
              code: allergy.status.toLowerCase(),
            },
          ],
        },
        criticality: (allergy as any).criticality?.toLowerCase() || (allergy.severity === 'LIFE_THREATENING' || allergy.severity === 'SEVERE' ? 'high' : 'low'),
        code: { text: allergy.substance },
        patient: { reference: `Patient/${allergy.patientId.toString()}` },
        reaction: (allergy.reactions || []).map((r: string) => ({
          manifestation: [{ text: r }],
          severity: allergy.severity?.toLowerCase() || 'moderate',
        })),
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(fhirResource);
    } catch (err) {
      next(err);
    }
  }

  // --- FHIR R4 MedicationRequest ---
  static async getMedicationRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rx = await PrescriptionModel.findById(req.params.id).lean();
      if (!rx) throw new NotFoundError('FHIR MedicationRequest not found');

      const fhirResource = {
        resourceType: 'MedicationRequest',
        id: rx._id.toString(),
        status: rx.status === 'VERIFIED' ? 'active' : rx.status === 'DISPENSED' ? 'completed' : 'stopped',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: rx.drug.code,
              display: rx.drug.name,
            },
          ],
          text: rx.drug.name,
        },
        subject: { reference: `Patient/${rx.patientId.toString()}` },
        authoredOn: rx.createdAt.toISOString(),
        requester: { reference: `Practitioner/${rx.prescribedBy.toString()}` },
        dosageInstruction: [
          {
            text: rx.instructions,
            timing: { code: { text: rx.dosage.frequency } },
            route: { text: rx.dosage.route },
            doseAndRate: [{ doseQuantity: { value: parseFloat(rx.dosage.dose) || 1, unit: rx.dosage.unit } }],
          },
        ],
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(fhirResource);
    } catch (err) {
      next(err);
    }
  }

  // --- FHIR R4 Procedure ---
  static async getProcedure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proc = await ProcedureModel.findById(req.params.id).lean();
      if (!proc) throw new NotFoundError('FHIR Procedure not found');

      const fhirResource = {
        resourceType: 'Procedure',
        id: proc._id.toString(),
        status: proc.status === 'COMPLETED' ? 'completed' : 'in-progress',
        code: {
          coding: [
            {
              system: 'http://www.ama-assn.org/go/cpt',
              code: proc.code,
              display: proc.name,
            },
          ],
          text: proc.name,
        },
        subject: { reference: `Patient/${proc.patientId.toString()}` },
        performedDateTime: proc.performedAt?.toISOString() || proc.createdAt.toISOString(),
      };

      res.setHeader('Content-Type', 'application/fhir+json');
      res.status(200).json(fhirResource);
    } catch (err) {
      next(err);
    }
  }
}
