import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { ProcedureModel } from '../modules/procedures/procedure.model.js';
import { ProcedureCatalogModel } from '../modules/procedures/procedureCatalog.model.js';
import { OrderModel } from '../modules/orders/order.model.js';
import { PrescriptionModel } from '../modules/prescriptions/prescription.model.js';
import { AllergyModel } from '../modules/allergies/allergy.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { RoleController } from '../modules/roles/role.controller.js';
import { hashPassword } from '../utils/crypto.util.js';
import { SYSTEM_ROLES, PROCEDURE_CATEGORIES } from '@ehr/shared';

describe('Phase 5 Integration: Procedures (7 Discriminators), Orders & Prescriptions Engine', () => {
  const app = createApp();
  let physicianToken: string;
  let physicianId: string;
  let nurseToken: string;
  let pharmacistToken: string;
  let pharmacistId: string;
  let patientId: string;
  const mockFacilityId = new mongoose.Types.ObjectId().toString();
  const mockDeptId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await connectDB();
    await PatientModel.deleteMany({});
    await ProcedureModel.deleteMany({});
    await ProcedureCatalogModel.deleteMany({});
    await OrderModel.deleteMany({});
    await PrescriptionModel.deleteMany({});
    await AllergyModel.deleteMany({});
    await UserModel.deleteMany({});
    await RoleModel.deleteMany({});

    await RoleController.ensureDefaultRoles();
    const physicianRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHYSICIAN });
    const nurseRole = await RoleModel.findOne({ name: SYSTEM_ROLES.NURSE });
    const pharmacistRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHARMACIST });
    const adminRole = await RoleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });

    const passwordHash = await hashPassword('Password123!@#');

    // Create Admin
    await UserModel.create({
      email: 'admin.proc@test.org',
      passwordHash,
      name: { given: ['System'], family: 'Admin' },
      roleIds: [adminRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });

    // Create Physician
    const physician = await UserModel.create({
      email: 'dr.smith@test.org',
      passwordHash,
      name: { given: ['John'], family: 'Smith' },
      roleIds: [physicianRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });
    physicianId = physician._id.toString();

    // Create Nurse
    await UserModel.create({
      email: 'nurse.joy@test.org',
      passwordHash,
      name: { given: ['Joy'], family: 'Nurse' },
      roleIds: [nurseRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });

    // Create Pharmacist
    const pharmacist = await UserModel.create({
      email: 'rx.jack@test.org',
      passwordHash,
      name: { given: ['Jack'], family: 'Pharmacist' },
      roleIds: [pharmacistRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });
    pharmacistId = pharmacist._id.toString();

    // Logins
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.proc@test.org', password: 'Password123!@#' });
    const adminToken = adminLogin.body.data.accessToken;

    const drLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dr.smith@test.org', password: 'Password123!@#' });
    physicianToken = drLogin.body.data.accessToken;

    const nurseLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nurse.joy@test.org', password: 'Password123!@#' });
    nurseToken = nurseLogin.body.data.accessToken;

    const rxLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rx.jack@test.org', password: 'Password123!@#' });
    pharmacistToken = rxLogin.body.data.accessToken;

    // Create Patient
    const patient = await PatientModel.create({
      mrn: 'FAC-500001',
      facilityId: new mongoose.Types.ObjectId(mockFacilityId),
      name: { given: ['Robert'], family: 'Paulson' },
      searchName: 'paulson robert',
      dob: '1975-10-10',
      sex: 'MALE',
      identifiers: [],
      contact: { phones: [{ value: 'enc', blindIndex: 'idx' }] },
      address: { street: 'enc', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'USA' },
      flags: { vip: false, restricted: false, deceased: false },
      status: 'ACTIVE',
    });
    patientId = patient._id.toString();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Procedure Catalog & 7 Mongoose Discriminators', () => {
    it('creates and lists procedure catalog items', async () => {
      // First login as admin
      const adminLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin.proc@test.org', password: 'Password123!@#' });
      const adminToken = adminLogin.body.data.accessToken;

      const createRes = await request(app)
        .post('/api/v1/procedures/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: '47562',
          codeSystem: 'CPT',
          name: 'Laparoscopic Cholecystectomy',
          category: PROCEDURE_CATEGORIES.SURGICAL,
          defaultDurationMin: 90,
          price: 3500.0,
          requiredPermission: 'PROCEDURE_PERFORM_SURGICAL',
          active: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.code).toBe('47562');

      const listRes = await request(app)
        .get('/api/v1/procedures/catalog')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('denies surgical procedure recording to non-physicians (Nurse)', async () => {
      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/procedures`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          code: '47562',
          codeSystem: 'CPT',
          name: 'Laparoscopic Cholecystectomy',
          category: PROCEDURE_CATEGORIES.SURGICAL,
          surgeonId: physicianId,
          anesthesiaType: 'GENERAL',
          preOpDiagnosis: 'Acute Cholecystitis',
          postOpDiagnosis: 'Chronic Cholecystitis',
          asaClass: 'ASA_II',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          whoChecklistCompleted: true,
        });

      expect(res.status).toBe(403);
    });

    it('allows physician to record surgical procedure with discriminator schema', async () => {
      const res = await request(app)
        .post(`/api/v1/patients/${patientId}/procedures`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          code: '47562',
          codeSystem: 'CPT',
          name: 'Laparoscopic Cholecystectomy',
          category: PROCEDURE_CATEGORIES.SURGICAL,
          surgeonId: physicianId,
          anesthesiaType: 'GENERAL',
          preOpDiagnosis: 'Acute Cholecystitis',
          postOpDiagnosis: 'Chronic Cholecystitis',
          asaClass: 'ASA_II',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          estimatedBloodLossMl: 50,
          whoChecklistCompleted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.category).toBe(PROCEDURE_CATEGORIES.SURGICAL);
      expect(res.body.data.asaClass).toBe('ASA_II');
      expect(res.body.data.estimatedBloodLossMl).toBe(50);
    });

    it('records Imaging and Diagnostic procedures with specific fields', async () => {
      // Diagnostic procedure
      const diagRes = await request(app)
        .post(`/api/v1/patients/${patientId}/procedures`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          code: '43235',
          codeSystem: 'CPT',
          name: 'Upper GI Endoscopy (EGD)',
          category: PROCEDURE_CATEGORIES.DIAGNOSTIC,
          indication: 'Dyspepsia and epigastric pain',
          findings: 'Mild antral gastritis, no ulcers',
          specimenId: 'SPEC-9921',
        });

      expect(diagRes.status).toBe(201);
      expect(diagRes.body.data.findings).toBe('Mild antral gastritis, no ulcers');

      // Imaging procedure
      const imgRes = await request(app)
        .post(`/api/v1/patients/${patientId}/procedures`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          code: '71046',
          codeSystem: 'CPT',
          name: 'Chest X-Ray 2 Views',
          category: PROCEDURE_CATEGORIES.IMAGING,
          modality: 'XR',
          bodyPart: 'Chest',
          contrastUsed: false,
          radiationDoseMgy: 0.1,
          studyUid: '1.2.840.10008.5.1.4.1.1.1',
        });

      expect(imgRes.status).toBe(201);
      expect(imgRes.body.data.modality).toBe('XR');
      expect(imgRes.body.data.radiationDoseMgy).toBe(0.1);
    });

    it('completes procedure and enforces immutability', async () => {
      // Create a therapeutic procedure
      const createRes = await request(app)
        .post(`/api/v1/patients/${patientId}/procedures`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          code: '12001',
          codeSystem: 'CPT',
          name: 'Simple Laceration Repair 2.5cm',
          category: PROCEDURE_CATEGORIES.THERAPEUTIC,
          site: 'Left Forearm',
          technique: 'Interrupted 4-0 Ethilon sutures',
          anesthesiaLocal: true,
        });

      const procId = createRes.body.data._id;

      // Complete procedure
      const completeRes = await request(app)
        .patch(`/api/v1/procedures/${procId}/complete`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          outcome: 'Hemostasis achieved, clean closure',
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('COMPLETED');
      expect(completeRes.body.data.performedAt).toBeDefined();

      // Attempting to complete again should return 409 Conflict
      const secondComplete = await request(app)
        .patch(`/api/v1/procedures/${procId}/complete`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ outcome: 'Trying to modify completed procedure' });

      expect(secondComplete.status).toBe(409);
    });
  });

  describe('Clinical Orders Module', () => {
    it('creates, signs, and cancels clinical orders', async () => {
      // 1. Create order
      const orderRes = await request(app)
        .post(`/api/v1/patients/${patientId}/orders`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          type: 'LAB',
          catalogCode: 'CBC-85025',
          name: 'Complete Blood Count (CBC) with Diff',
          priority: 'STAT',
          indication: 'Evaluate acute anemia and fatigue',
          destinationDeptId: mockDeptId,
          details: { tubeType: 'LAVENDER_EDTA' },
          isControlledSubstance: false,
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.data.priority).toBe('STAT');
      expect(orderRes.body.data.status).toBe('ORDERED');
      const orderId = orderRes.body.data._id;

      // 2. Sign order
      const signRes = await request(app)
        .patch(`/api/v1/orders/${orderId}/sign`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({});

      expect(signRes.status).toBe(200);
      expect(signRes.body.data.signedAt).toBeDefined();

      // 3. Cancel order
      const cancelRes = await request(app)
        .patch(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({});

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });

    it('requires PIN signature for controlled substance orders', async () => {
      const orderRes = await request(app)
        .post(`/api/v1/patients/${patientId}/orders`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          type: 'MEDICATION',
          catalogCode: 'RX-OXY-01',
          name: 'Oxycodone 5mg Oral Tablet',
          priority: 'URGENT',
          indication: 'Post-operative severe pain',
          destinationDeptId: mockDeptId,
          isControlledSubstance: true,
        });

      const orderId = orderRes.body.data._id;

      // Sign without PIN should be forbidden
      const signNoPin = await request(app)
        .patch(`/api/v1/orders/${orderId}/sign`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({});

      expect(signNoPin.status).toBe(403);

      // Sign with PIN
      const signWithPin = await request(app)
        .patch(`/api/v1/orders/${orderId}/sign`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ pin: '1234' });

      expect(signWithPin.status).toBe(200);
      expect(signWithPin.body.data.signedAt).toBeDefined();
    });
  });

  describe('Prescription Engine & Drug Interaction Interception', () => {
    beforeAll(async () => {
      // Document active Penicillin allergy for patient
      await AllergyModel.create({
        patientId: new mongoose.Types.ObjectId(patientId),
        substance: 'Penicillin',
        category: 'MEDICATION',
        criticality: 'HIGH',
        severity: 'LIFE_THREATENING',
        status: 'ACTIVE',
        reactions: ['Anaphylaxis', 'Laryngeal Edema', 'Urticaria'],
        recordedBy: new mongoose.Types.ObjectId(physicianId),
      });
    });

    it('intercepts drug-allergy cross-reactivity (Amoxicillin vs Penicillin Allergy)', async () => {
      // Attempting to prescribe Amoxicillin without override reason
      const conflictRes = await request(app)
        .post(`/api/v1/patients/${patientId}/prescriptions`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          drug: {
            code: '723',
            name: 'Amoxicillin 500mg Capsule',
            strength: '500mg',
            form: 'Capsule',
          },
          dosage: {
            dose: '500',
            unit: 'mg',
            route: 'ORAL',
            frequency: 'TID',
          },
          durationDays: 7,
          quantity: 21,
          refills: 0,
          instructions: 'Take 1 capsule by mouth every 8 hours for 7 days',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.code).toBe('CLINICAL_INTERACTION_CONFLICT');
      expect(conflictRes.body.warnings.length).toBeGreaterThanOrEqual(1);
      expect(conflictRes.body.warnings[0].type).toBe('DRUG_ALLERGY');
      expect(conflictRes.body.warnings[0].severity).toBe('MAJOR');
    });

    it('allows prescription with explicit clinical override reason', async () => {
      const overrideRes = await request(app)
        .post(`/api/v1/patients/${patientId}/prescriptions`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          drug: {
            code: '723',
            name: 'Amoxicillin 500mg Capsule',
            strength: '500mg',
            form: 'Capsule',
          },
          dosage: {
            dose: '500',
            unit: 'mg',
            route: 'ORAL',
            frequency: 'TID',
          },
          durationDays: 7,
          quantity: 21,
          refills: 0,
          instructions: 'Take 1 capsule by mouth every 8 hours with food',
          overrideWarningReason: 'Desensitization protocol completed in ICU, emergency administration required',
        });

      expect(overrideRes.status).toBe(201);
      expect(overrideRes.body.data.status).toBe('ACTIVE');
      expect(overrideRes.body.data.overrideWarningReason).toBeDefined();
    });

    it('detects drug-drug interaction when candidate interacts with active Rx (Warfarin + Aspirin)', async () => {
      // 1. Prescribe Warfarin
      await request(app)
        .post(`/api/v1/patients/${patientId}/prescriptions`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          drug: {
            code: '11289',
            name: 'Warfarin Sodium 5mg Tablet',
            strength: '5mg',
            form: 'Tablet',
          },
          dosage: {
            dose: '5',
            unit: 'mg',
            route: 'ORAL',
            frequency: 'QD_EVENING',
          },
          durationDays: 30,
          quantity: 30,
          refills: 2,
          instructions: 'Take 1 tablet daily at evening as directed by INR',
        });

      // 2. Prescribe Aspirin -> Should detect major interaction with active Warfarin
      const ddiRes = await request(app)
        .post(`/api/v1/patients/${patientId}/prescriptions`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          drug: {
            code: '1191',
            name: 'Aspirin 325mg Oral Tablet',
            strength: '325mg',
            form: 'Tablet',
          },
          dosage: {
            dose: '325',
            unit: 'mg',
            route: 'ORAL',
            frequency: 'QD',
          },
          durationDays: 30,
          quantity: 30,
          refills: 0,
          instructions: 'Take 1 tablet daily',
        });

      expect(ddiRes.status).toBe(409);
      expect(ddiRes.body.warnings.some((w: any) => w.type === 'DRUG_DRUG')).toBe(true);
    });

    it('handles Pharmacist Verification and Dispense lifecycle', async () => {
      // Create non-conflicting prescription
      const rxRes = await request(app)
        .post(`/api/v1/patients/${patientId}/prescriptions`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          drug: {
            code: '6809',
            name: 'Metformin HCl 500mg Tablet',
            strength: '500mg',
            form: 'Tablet',
          },
          dosage: {
            dose: '500',
            unit: 'mg',
            route: 'ORAL',
            frequency: 'BID',
          },
          durationDays: 30,
          quantity: 60,
          refills: 3,
          instructions: 'Take 1 tablet twice daily with meals',
        });

      const rxId = rxRes.body.data._id;
      expect(rxRes.body.data.status).toBe('ACTIVE');

      // Pharmacist Verifies
      const verifyRes = await request(app)
        .patch(`/api/v1/prescriptions/${rxId}/verify`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({});

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.status).toBe('VERIFIED');
      expect(verifyRes.body.data.verifiedBy).toBe(pharmacistId);

      // Pharmacist Dispenses
      const dispenseRes = await request(app)
        .patch(`/api/v1/prescriptions/${rxId}/dispense`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ lotNumber: 'LOT-998822', quantityDispensed: 60 });

      expect(dispenseRes.status).toBe(200);
      expect(dispenseRes.body.data.status).toBe('DISPENSED');
      expect(dispenseRes.body.data.dispensedBy).toBe(pharmacistId);
    });
  });
});
