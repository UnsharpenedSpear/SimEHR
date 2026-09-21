import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { EncounterModel } from '../modules/encounters/encounter.model.js';
import { ClinicalNoteModel } from '../modules/clinical-notes/clinicalNote.model.js';
import { VitalsModel, calculateBMI, evaluateVitalsFlags } from '../modules/vitals/vitals.model.js';
import { ProblemModel } from '../modules/problems/problem.model.js';
import { AllergyModel } from '../modules/allergies/allergy.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { RoleController } from '../modules/roles/role.controller.js';
import { hashPassword } from '../utils/crypto.util.js';
import { SYSTEM_ROLES } from '@ehr/shared';

describe('Phase 4 Integration: Clinical Chart, Encounters, Notes, Vitals & Timeline', () => {
  const app = createApp();
  let physicianToken: string;
  let physicianId: string;
  let patientId: string;
  let encounterId: string;
  const mockFacilityId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await connectDB();
    await PatientModel.deleteMany({});
    await EncounterModel.deleteMany({});
    await ClinicalNoteModel.deleteMany({});
    await VitalsModel.deleteMany({});
    await ProblemModel.deleteMany({});
    await AllergyModel.deleteMany({});
    await UserModel.deleteMany({});
    await RoleModel.deleteMany({});

    await RoleController.ensureDefaultRoles();
    const physicianRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHYSICIAN });

    const passwordHash = await hashPassword('Password123!@#');
    const physician = await UserModel.create({
      email: 'doctor_p4@test.org',
      passwordHash,
      name: { given: ['Gregory'], family: 'House' },
      roleIds: [physicianRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });
    physicianId = physician._id.toString();

    // Login physician
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'doctor_p4@test.org', password: 'Password123!@#' });

    physicianToken = loginRes.body.data.accessToken;

    // Create a test patient
    const patient = await PatientModel.create({
      mrn: 'FAC-400001',
      facilityId: new mongoose.Types.ObjectId(mockFacilityId),
      name: { given: ['Sarah'], family: 'Connor' },
      searchName: 'connor sarah',
      dob: '1984-05-12',
      sex: 'FEMALE',
      identifiers: [],
      contact: { phones: [{ value: 'enc', blindIndex: 'idx' }] },
      address: { street: 'enc', city: 'Los Angeles', state: 'CA', postalCode: '90001', country: 'USA' },
      flags: { vip: false, restricted: false, deceased: false },
      status: 'ACTIVE',
    });
    patientId = patient._id.toString();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Vitals Engine & Outliers', () => {
    it('computes BMI and flags abnormal vitals (Hypertension Stage 2, Hypoxia)', async () => {
      const bmi = calculateBMI(70, 175);
      expect(bmi).toBe(22.9);

      const flags = evaluateVitalsFlags({
        bp: { systolic: 155, diastolic: 95 },
        hr: 110,
        spo2: 88,
        tempC: 39.0,
      });

      expect(flags).toContain('HYPERTENSION_STAGE_2');
      expect(flags).toContain('TACHYCARDIA');
      expect(flags).toContain('HYPOXIA_CRITICAL');
      expect(flags).toContain('FEVER_HIGH');

      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/vitals`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          weightKg: 70,
          heightCm: 175,
          bp: { systolic: 155, diastolic: 95 },
          hr: 110,
          spo2: 88,
          tempC: 39.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.bmi).toBe(22.9);
      expect(res.body.data.abnormalFlags).toContain('HYPOXIA_CRITICAL');
    });
  });

  describe('Encounters & SOAP Notes Workflow', () => {
    it('creates encounter, documents SOAP note, signs note, and enforces immutability', async () => {
      // 1. Create Encounter
      const encRes = await request(app)
        .post(`/api/v1/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          facilityId: mockFacilityId,
          type: 'OUTPATIENT',
          departmentId: new mongoose.Types.ObjectId().toString(),
          reasonForVisit: 'Acute respiratory shortness of breath and fever',
          diagnoses: [{ code: 'J20.9', display: 'Acute Bronchitis', isPrimary: true }],
        });

      expect(encRes.status).toBe(201);
      encounterId = encRes.body.data._id;

      // 2. Create Draft SOAP note
      const noteRes = await request(app)
        .post(`/api/v1/patients/${patientId}/notes`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          encounterId,
          template: 'SOAP',
          title: 'Initial Outpatient Consultation Note',
          sections: {
            subjective: 'Patient reports 3 days of productive cough and dyspnea.',
            objective: 'Temp 39C, SpO2 88% on room air, bilateral rhonchi on lung auscultation.',
            assessment: 'Acute Bronchitis with secondary hypoxia.',
            plan: 'Supplemental O2 2L NC, obtain STAT chest X-Ray and CBC.',
          },
        });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.data.status).toBe('DRAFT');
      const noteId = noteRes.body.data._id;

      // 3. Sign Clinical Note
      const signRes = await request(app)
        .post(`/api/v1/notes/${noteId}/sign`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(signRes.status).toBe(200);
      expect(signRes.body.data.status).toBe('SIGNED');
      expect(signRes.body.data.signedAt).toBeDefined();

      // 4. Attempt re-signing (Immutability check)
      const reSignRes = await request(app)
        .post(`/api/v1/notes/${noteId}/sign`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(reSignRes.status).toBe(409); // Conflict

      // 5. Create Versioned Amendment
      const amendRes = await request(app)
        .post(`/api/v1/notes/${noteId}/amend`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          amendmentReason: 'Added clarithromycin prescription details post-allergy review',
          content: {
            addendum: 'Patient has confirmed Penicillin allergy. Prescribed Clarithromycin 500mg BID x 7d.',
          },
        });

      expect(amendRes.status).toBe(201);
      expect(amendRes.body.data.version).toBe(2);
      expect(amendRes.body.data.previousVersionId).toBe(noteId);
    });
  });

  describe('Problems, Allergies, Chart Summary & Timeline Aggregation', () => {
    it('records problems, allergies, and aggregates full chart summary & timeline', async () => {
      // 1. Record Allergy
      await request(app)
        .post(`/api/v1/patients/${patientId}/allergies`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          substance: 'Penicillin',
          category: 'MEDICATION',
          reactions: ['Anaphylaxis', 'Urticaria'],
          severity: 'SEVERE',
          status: 'ACTIVE',
        });

      // 2. Record Problem
      await request(app)
        .post(`/api/v1/patients/${patientId}/problems`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          icd10: 'J45.909',
          description: 'Unspecified asthma, uncomplicated',
          status: 'ACTIVE',
        });

      // 3. Query Chart Summary
      const summaryRes = await request(app)
        .get(`/api/v1/patients/${patientId}/chart-summary`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.banner.mrn).toBe('FAC-400001');
      expect(summaryRes.body.data.allergies.length).toBeGreaterThanOrEqual(1);
      expect(summaryRes.body.data.problems.length).toBeGreaterThanOrEqual(1);
      expect(summaryRes.body.data.lastVitals).toBeDefined();

      // 4. Query Unified Chronological Timeline
      const timelineRes = await request(app)
        .get(`/api/v1/patients/${patientId}/timeline`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(timelineRes.status).toBe(200);
      expect(timelineRes.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
