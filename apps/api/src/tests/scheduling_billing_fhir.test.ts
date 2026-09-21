import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { EncounterModel } from '../modules/encounters/encounter.model.js';
import { AppointmentModel } from '../modules/appointments/appointment.model.js';
import { InvoiceModel } from '../modules/billing/invoice.model.js';
import { DepartmentModel } from '../modules/departments/department.model.js';
import { LabResultModel } from '../modules/diagnostics/labResult.model.js';
import { ProblemModel } from '../modules/problems/problem.model.js';
import { AllergyModel } from '../modules/allergies/allergy.model.js';
import { PrescriptionModel } from '../modules/prescriptions/prescription.model.js';
import { ProcedureModel } from '../modules/procedures/procedure.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { RoleController } from '../modules/roles/role.controller.js';
import { hashPassword } from '../utils/crypto.util.js';
import { SYSTEM_ROLES, APPOINTMENT_STATUSES } from '@ehr/shared';

describe('Phase 7 Integration: Scheduling, Billing, Reports & FHIR R4 Facade', () => {
  const app = createApp();
  let adminToken: string;
  let physicianToken: string;
  let physicianId: string;
  let patientId: string;
  let facilityId: string;
  let departmentId: string;
  let encounterId: string;
  let labResultId: string;
  let problemId: string;
  let allergyId: string;
  let rxId: string;
  let procedureId: string;

  beforeAll(async () => {
    await connectDB();
    await PatientModel.deleteMany({});
    await EncounterModel.deleteMany({});
    await AppointmentModel.deleteMany({});
    await InvoiceModel.deleteMany({});
    await DepartmentModel.deleteMany({});
    await LabResultModel.deleteMany({});
    await ProblemModel.deleteMany({});
    await AllergyModel.deleteMany({});
    await PrescriptionModel.deleteMany({});
    await ProcedureModel.deleteMany({});
    await UserModel.deleteMany({});
    await RoleModel.deleteMany({});

    await RoleController.ensureDefaultRoles();
    const adminRole = await RoleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });
    const physicianRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHYSICIAN });

    facilityId = new mongoose.Types.ObjectId().toString();

    // Create Department
    const dept = await DepartmentModel.create({
      facilityId: new mongoose.Types.ObjectId(facilityId),
      code: 'CARDIO-01',
      name: 'Cardiology Clinic',
      type: 'OUTPATIENT_CLINIC',
      active: true,
    });
    departmentId = dept._id.toString();

    const passwordHash = await hashPassword('Password123!@#');

    // Create Admin
    await UserModel.create({
      email: 'admin.p7@test.org',
      passwordHash,
      name: { given: ['Admin'], family: 'Seven' },
      roleIds: [adminRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(facilityId)],
      status: 'ACTIVE',
    });

    // Create Physician
    const physician = await UserModel.create({
      email: 'dr.seven@test.org',
      passwordHash,
      name: { given: ['Stephen'], family: 'Strange' },
      roleIds: [physicianRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(facilityId)],
      departmentIds: [dept._id],
      status: 'ACTIVE',
    });
    physicianId = physician._id.toString();

    // Logins
    const adminLog = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.p7@test.org', password: 'Password123!@#' });
    adminToken = adminLog.body.data.accessToken;

    const drLog = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dr.seven@test.org', password: 'Password123!@#' });
    physicianToken = drLog.body.data.accessToken;

    // Create Patient
    const patient = await PatientModel.create({
      mrn: 'FAC-700001',
      facilityId: new mongoose.Types.ObjectId(facilityId),
      name: { given: ['Tony'], family: 'Stark' },
      searchName: 'stark tony',
      dob: '1970-05-29',
      sex: 'MALE',
      identifiers: [],
      contact: { phones: [{ value: 'enc', blindIndex: 'idx' }] },
      address: { street: 'enc', city: 'Malibu', state: 'CA', postalCode: '90265', country: 'USA' },
      flags: { vip: true, restricted: false, deceased: false },
      status: 'ACTIVE',
    });
    patientId = patient._id.toString();

    // Create Encounter
    const enc = await EncounterModel.create({
      patientId: patient._id,
      facilityId: new mongoose.Types.ObjectId(facilityId),
      departmentId: dept._id,
      attendingId: physician._id,
      type: 'OUTPATIENT',
      status: 'IN_PROGRESS',
      reasonForVisit: 'Chest pain and arrhythmia check',
      start: new Date(),
    });
    encounterId = enc._id.toString();

    // Create Lab Result
    const lab = await LabResultModel.create({
      orderId: new mongoose.Types.ObjectId(),
      patientId: patient._id,
      analyteCode: '10839-9',
      analyteName: 'Troponin I.cardiac [Mass/volume]',
      value: 0.02,
      numericValue: 0.02,
      unit: 'ng/mL',
      referenceRange: { low: 0, high: 0.04 },
      flag: 'NORMAL',
      status: 'FINAL',
      recordedBy: physician._id,
    });
    labResultId = lab._id.toString();

    // Create Problem
    const problem = await ProblemModel.create({
      patientId: patient._id,
      icd10: 'I20.9',
      description: 'Angina pectoris, unspecified',
      status: 'ACTIVE',
      onset: '2026-01-15',
      recordedBy: physician._id,
    });
    problemId = problem._id.toString();

    // Create Allergy
    const allergy = await AllergyModel.create({
      patientId: patient._id,
      substance: 'Shellfish',
      category: 'FOOD',
      criticality: 'HIGH',
      severity: 'SEVERE',
      status: 'ACTIVE',
      reactions: ['Urticaria', 'Angioedema'],
      recordedBy: physician._id,
    });
    allergyId = allergy._id.toString();

    // Create Prescription
    const rx = await PrescriptionModel.create({
      patientId: patient._id,
      drug: {
        code: '197361',
        name: 'Amlodipine 5mg Tablet',
        strength: '5mg',
        form: 'TABLET',
      },
      dosage: {
        dose: '5',
        unit: 'mg',
        route: 'ORAL',
        frequency: 'QD',
      },
      durationDays: 30,
      quantity: 30,
      instructions: 'Take 1 tablet daily in the morning',
      status: 'ACTIVE',
      prescribedBy: physician._id,
    });
    rxId = rx._id.toString();

    // Create Procedure
    const proc = await ProcedureModel.create({
      patientId: patient._id,
      code: '93000',
      name: 'Electrocardiogram (ECG) 12-lead',
      category: 'DIAGNOSTIC',
      status: 'COMPLETED',
      indication: 'Chest pain evaluation',
      findings: 'Normal sinus rhythm with non-specific ST-T wave changes',
      performedBy: [physician._id],
      performedAt: new Date(),
    });
    procedureId = proc._id.toString();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Scheduling Engine & Double-Booking Prevention', () => {
    let appointmentId: string;

    it('creates appointment and calculates duration', async () => {
      const start = '2026-10-15T09:00:00.000Z';
      const end = '2026-10-15T09:30:00.000Z';

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId,
          providerId: physicianId,
          facilityId,
          departmentId,
          type: 'ROUTINE',
          start,
          end,
          reason: 'Annual cardiology consultation',
          room: 'Exam Room 2',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.durationMin).toBe(30);
      expect(res.body.data.status).toBe(APPOINTMENT_STATUSES.CONFIRMED);
      appointmentId = res.body.data._id;
    });

    it('rejects overlapping appointment for the same provider (double booking prevention) with 409 Conflict', async () => {
      // Overlaps from 09:15 to 09:45
      const overlapStart = '2026-10-15T09:15:00.000Z';
      const overlapEnd = '2026-10-15T09:45:00.000Z';

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId,
          providerId: physicianId,
          facilityId,
          departmentId,
          type: 'FOLLOW_UP',
          start: overlapStart,
          end: overlapEnd,
          reason: 'Follow-up ECG check',
        });

      expect(res.status).toBe(409);
    });

    it('processes check-in and auto-creates arrived clinical encounter', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/check-in`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.appointment.status).toBe(APPOINTMENT_STATUSES.CHECKED_IN);
      expect(res.body.data.appointment.encounterId).toBeDefined();
      expect(res.body.data.encounter.status).toBe('ARRIVED');
    });
  });

  describe('Billing & Invoicing Engine', () => {
    let invoiceId: string;

    it('creates invoice with automated numbering and line item totals', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId,
          encounterId,
          facilityId,
          lineItems: [
            {
              code: '99214',
              description: 'Office visit, established patient level 4',
              quantity: 1,
              unitPrice: 150.0,
              totalPrice: 150.0,
            },
            {
              code: '93000',
              description: '12-lead Electrocardiogram (ECG)',
              quantity: 1,
              unitPrice: 75.0,
              totalPrice: 75.0,
            },
          ],
          payer: { type: 'SELF_PAY' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.invoiceNumber).toMatch(/^INV-FAC-\d{4}-\d{6}$/);
      expect(res.body.data.totalAmount).toBe(225.0);
      expect(res.body.data.balanceDue).toBe(225.0);
      expect(res.body.data.status).toBe('ISSUED');
      invoiceId = res.body.data._id;
    });

    it('records partial payment and updates balance due', async () => {
      const res = await request(app)
        .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 100.0,
          method: 'CREDIT_CARD',
          referenceNumber: 'TX-998811',
          notes: 'Partial payment by Visa',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.amountPaid).toBe(100.0);
      expect(res.body.data.balanceDue).toBe(125.0);
      expect(res.body.data.status).toBe('PARTIALLY_PAID');
    });

    it('settles remaining balance and transitions invoice to PAID', async () => {
      const res = await request(app)
        .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 125.0,
          method: 'CASH',
          referenceNumber: 'RCPT-0012',
          notes: 'Final settlement in cash',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.amountPaid).toBe(225.0);
      expect(res.body.data.balanceDue).toBe(0);
      expect(res.body.data.status).toBe('PAID');
    });
  });

  describe('Operational & Clinical Reports', () => {
    it('generates daily hospital census report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/census')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalActivePatients).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.byDepartment)).toBe(true);
    });

    it('generates dispatch SLA compliance metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dispatch-sla')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overallCompliancePercent).toBeDefined();
    });

    it('generates financial revenue and outstanding balance report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalBilled).toBeGreaterThanOrEqual(225.0);
      expect(res.body.data.summary.totalCollected).toBeGreaterThanOrEqual(225.0);
    });
  });

  describe('HL7 FHIR R4 Read-Only Facade', () => {
    it('fetches FHIR R4 Patient resource conforming to standard schema', async () => {
      const res = await request(app)
        .get(`/fhir/Patient/${patientId}`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/fhir+json');
      expect(res.body.resourceType).toBe('Patient');
      expect(res.body.id).toBe(patientId);
      expect(res.body.identifier[0].value).toBe('FAC-700001');
      expect(res.body.name[0].family).toBe('Stark');
      expect(res.body.gender).toBe('male');
    });

    it('searches FHIR R4 Patients bundle', async () => {
      const res = await request(app)
        .get('/fhir/Patient?gender=male')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.type).toBe('searchset');
      expect(res.body.entry.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches FHIR R4 Encounter, Observation, Condition, Allergy, MedicationRequest, and Procedure resources', async () => {
      // 1. Encounter
      const encRes = await request(app)
        .get(`/fhir/Encounter/${encounterId}`)
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(encRes.status).toBe(200);
      expect(encRes.body.resourceType).toBe('Encounter');

      // 2. Observation
      const obsRes = await request(app)
        .get(`/fhir/Observation/${labResultId}`)
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(obsRes.status).toBe(200);
      expect(obsRes.body.resourceType).toBe('Observation');
      expect(obsRes.body.code.coding[0].code).toBe('10839-9');

      // 3. Condition
      const condRes = await request(app)
        .get(`/fhir/Condition/${problemId}`)
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(condRes.status).toBe(200);
      expect(condRes.body.resourceType).toBe('Condition');
      expect(condRes.body.code.coding[0].code).toBe('I20.9');

      // 4. AllergyIntolerance
      const allergyRes = await request(app)
        .get(`/fhir/AllergyIntolerance/${allergyId}`)
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(allergyRes.status).toBe(200);
      expect(allergyRes.body.resourceType).toBe('AllergyIntolerance');

      // 5. MedicationRequest
      const medRes = await request(app)
        .get(`/fhir/MedicationRequest/${rxId}`)
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(medRes.status).toBe(200);
      expect(medRes.body.resourceType).toBe('MedicationRequest');

      // 6. Procedure
      const procRes = await request(app)
        .get(`/fhir/Procedure/${procedureId}`)
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(procRes.status).toBe(200);
      expect(procRes.body.resourceType).toBe('Procedure');
      expect(procRes.body.code.coding[0].code).toBe('93000');
    });
  });
});
