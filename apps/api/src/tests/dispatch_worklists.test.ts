import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { OrderModel } from '../modules/orders/order.model.js';
import { DepartmentModel } from '../modules/departments/department.model.js';
import { DispatchModel } from '../modules/dispatch/dispatch.model.js';
import { LabResultModel } from '../modules/diagnostics/labResult.model.js';
import { ImagingReportModel } from '../modules/diagnostics/imagingReport.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { RoleController } from '../modules/roles/role.controller.js';
import { DispatchSlaSweeper } from '../jobs/dispatchSla.sweeper.js';
import { hashPassword } from '../utils/crypto.util.js';
import { SYSTEM_ROLES, DISPATCH_STATUSES, DISPATCH_TYPES, ORDER_PRIORITIES } from '@ehr/shared';

describe('Phase 6 Integration: Real-time Dispatch FSM, Worklists & Diagnostics', () => {
  const app = createApp();
  let adminToken: string;
  let physicianToken: string;
  let labTechToken: string;
  let radiologistToken: string;
  let patientId: string;
  let orderId: string;
  let fromDeptId: string;
  let toDeptId: string;
  const mockFacilityId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await connectDB();
    await PatientModel.deleteMany({});
    await OrderModel.deleteMany({});
    await DepartmentModel.deleteMany({});
    await DispatchModel.deleteMany({});
    await LabResultModel.deleteMany({});
    await ImagingReportModel.deleteMany({});
    await UserModel.deleteMany({});
    await RoleModel.deleteMany({});

    await RoleController.ensureDefaultRoles();
    const adminRole = await RoleModel.findOne({ name: SYSTEM_ROLES.SUPER_ADMIN });
    const physicianRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHYSICIAN });
    const labTechRole = await RoleModel.findOne({ name: SYSTEM_ROLES.LAB_TECH });
    const radiologistRole = await RoleModel.findOne({ name: SYSTEM_ROLES.RADIOLOGIST });

    const passwordHash = await hashPassword('Password123!@#');

    // Create Departments
    const emergencyDept = await DepartmentModel.create({
      facilityId: new mongoose.Types.ObjectId(mockFacilityId),
      code: 'ED-01',
      name: 'Emergency Department',
      type: 'EMERGENCY',
      location: { building: 'Main', floor: '1', room: '100' },
      active: true,
    });
    fromDeptId = emergencyDept._id.toString();

    const labDept = await DepartmentModel.create({
      facilityId: new mongoose.Types.ObjectId(mockFacilityId),
      code: 'LAB-CENTRAL',
      name: 'Central Pathology Laboratory',
      type: 'LABORATORY',
      location: { building: 'East Wing', floor: 'B1', room: 'B10' },
      active: true,
    });
    toDeptId = labDept._id.toString();

    // Create Users
    await UserModel.create({
      email: 'admin.dispatch@test.org',
      passwordHash,
      name: { given: ['Admin'], family: 'System' },
      roleIds: [adminRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });

    await UserModel.create({
      email: 'dr.ed@test.org',
      passwordHash,
      name: { given: ['Mark'], family: 'Greene' },
      roleIds: [physicianRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      departmentIds: [emergencyDept._id],
      status: 'ACTIVE',
    });

    await UserModel.create({
      email: 'tech.lab@test.org',
      passwordHash,
      name: { given: ['Dexter'], family: 'Morgan' },
      roleIds: [labTechRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      departmentIds: [labDept._id],
      status: 'ACTIVE',
    });

    await UserModel.create({
      email: 'dr.rad@test.org',
      passwordHash,
      name: { given: ['Allison'], family: 'Cameron' },
      roleIds: [radiologistRole!._id],
      facilityIds: [new mongoose.Types.ObjectId(mockFacilityId)],
      status: 'ACTIVE',
    });

    // Logins
    const adminLog = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.dispatch@test.org', password: 'Password123!@#' });
    adminToken = adminLog.body.data.accessToken;

    const drLog = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dr.ed@test.org', password: 'Password123!@#' });
    physicianToken = drLog.body.data.accessToken;

    const labLog = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tech.lab@test.org', password: 'Password123!@#' });
    labTechToken = labLog.body.data.accessToken;

    const radLog = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dr.rad@test.org', password: 'Password123!@#' });
    radiologistToken = radLog.body.data.accessToken;

    // Create Patient
    const patient = await PatientModel.create({
      mrn: 'FAC-600001',
      facilityId: new mongoose.Types.ObjectId(mockFacilityId),
      name: { given: ['Walter'], family: 'White' },
      searchName: 'white walter',
      dob: '1958-09-07',
      sex: 'MALE',
      identifiers: [],
      contact: { phones: [{ value: 'enc', blindIndex: 'idx' }] },
      address: { street: 'enc', city: 'Albuquerque', state: 'NM', postalCode: '87101', country: 'USA' },
      flags: { vip: false, restricted: false, deceased: false },
      status: 'ACTIVE',
    });
    patientId = patient._id.toString();

    // Create Test Order
    const order = await OrderModel.create({
      patientId: patient._id,
      type: 'LAB',
      name: 'Comprehensive Metabolic Panel (CMP)',
      priority: 'STAT',
      indication: 'Acute altered mental status and electrolyte check',
      destinationDeptId: labDept._id,
      orderedBy: new mongoose.Types.ObjectId(),
      status: 'ORDERED',
    });
    orderId = order._id.toString();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Dispatch Finite State Machine & SLA Calculation', () => {
    let dispatchId: string;

    it('creates a STAT dispatch task with automated 20-min SLA calculation', async () => {
      const res = await request(app)
        .post('/api/v1/dispatch')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          orderId,
          patientId,
          facilityId: mockFacilityId,
          type: DISPATCH_TYPES.LAB_SPECIMEN,
          fromDeptId,
          toDeptId,
          priority: ORDER_PRIORITIES.STAT,
          notes: 'Urgent specimen transport from ED Room 3',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(DISPATCH_STATUSES.CREATED);
      expect(res.body.data.slaMinutes).toBe(20);
      expect(res.body.data.isBreached).toBe(false);
      expect(res.body.data.events.length).toBe(1);
      dispatchId = res.body.data._id;
    });

    it('rejects invalid state transition (CREATED -> COMPLETED) with 409 Conflict', async () => {
      const res = await request(app)
        .patch(`/api/v1/dispatch/${dispatchId}/transition`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({
          targetStatus: DISPATCH_STATUSES.COMPLETED,
        });

      expect(res.status).toBe(409);
    });

    it('executes valid state machine progression: CREATED -> DISPATCHED -> ACKNOWLEDGED -> IN_PROGRESS -> COMPLETED', async () => {
      // 1. CREATED -> DISPATCHED
      const step1 = await request(app)
        .patch(`/api/v1/dispatch/${dispatchId}/transition`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ targetStatus: DISPATCH_STATUSES.DISPATCHED });
      expect(step1.status).toBe(200);
      expect(step1.body.data.status).toBe(DISPATCH_STATUSES.DISPATCHED);

      // 2. DISPATCHED -> ACKNOWLEDGED (Lab Receiver acknowledges receipt)
      const step2 = await request(app)
        .patch(`/api/v1/dispatch/${dispatchId}/transition`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({ targetStatus: DISPATCH_STATUSES.ACKNOWLEDGED });
      expect(step2.status).toBe(200);
      expect(step2.body.data.status).toBe(DISPATCH_STATUSES.ACKNOWLEDGED);

      // 3. ACKNOWLEDGED -> IN_PROGRESS (Accessioning & testing in progress)
      const step3 = await request(app)
        .patch(`/api/v1/dispatch/${dispatchId}/transition`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({ targetStatus: DISPATCH_STATUSES.IN_PROGRESS });
      expect(step3.status).toBe(200);
      expect(step3.body.data.status).toBe(DISPATCH_STATUSES.IN_PROGRESS);

      // 4. IN_PROGRESS -> COMPLETED
      const step4 = await request(app)
        .patch(`/api/v1/dispatch/${dispatchId}/transition`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({ targetStatus: DISPATCH_STATUSES.COMPLETED });
      expect(step4.status).toBe(200);
      expect(step4.body.data.status).toBe(DISPATCH_STATUSES.COMPLETED);
      expect(step4.body.data.events.length).toBe(5);
    });

    it('enforces mandatory rejection reason when transitioning to REJECTED', async () => {
      // Create a second dispatch task
      const createRes = await request(app)
        .post('/api/v1/dispatch')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          orderId,
          patientId,
          facilityId: mockFacilityId,
          type: DISPATCH_TYPES.LAB_SPECIMEN,
          fromDeptId,
          toDeptId,
          priority: ORDER_PRIORITIES.ROUTINE,
        });

      const d2Id = createRes.body.data._id;

      // Dispatch it
      await request(app)
        .patch(`/api/v1/dispatch/${d2Id}/transition`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ targetStatus: DISPATCH_STATUSES.DISPATCHED });

      // Attempt to reject without reason -> should fail validation (422)
      const rejectNoReason = await request(app)
        .patch(`/api/v1/dispatch/${d2Id}/transition`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({ targetStatus: DISPATCH_STATUSES.REJECTED });

      expect(rejectNoReason.status).toBe(422);

      // Reject with reason
      const rejectWithReason = await request(app)
        .patch(`/api/v1/dispatch/${d2Id}/transition`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({
          targetStatus: DISPATCH_STATUSES.REJECTED,
          reason: 'Severe hemolysis, tube underfilled. Recollection requested.',
        });

      expect(rejectWithReason.status).toBe(200);
      expect(rejectWithReason.body.data.status).toBe(DISPATCH_STATUSES.REJECTED);
    });

    it('generates a PDF clinical routing slip with QR code', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatch/${dispatchId}/routing-slip`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('Diagnostic Worklists: Lab Results & Critical Flag Evaluation', () => {
    it('evaluates normal vs critical high lab results and updates order status', async () => {
      // Normal Potassium
      const normRes = await request(app)
        .post(`/api/v1/patients/${patientId}/diagnostics/labs`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({
          orderId,
          patientId,
          analyteCode: '2823-3',
          analyteName: 'Potassium [Moles/volume] in Serum or Plasma',
          value: 4.2,
          unit: 'mmol/L',
          referenceRange: {
            low: 3.5,
            high: 5.1,
            criticalLow: 2.8,
            criticalHigh: 6.2,
          },
        });

      expect(normRes.status).toBe(201);
      expect(normRes.body.data.flag).toBe('NORMAL');

      // Critical High Potassium (7.1 mmol/L)
      const critRes = await request(app)
        .post(`/api/v1/patients/${patientId}/diagnostics/labs`)
        .set('Authorization', `Bearer ${labTechToken}`)
        .send({
          orderId,
          patientId,
          analyteCode: '2823-3',
          analyteName: 'Potassium [Moles/volume] in Serum or Plasma',
          value: 7.1,
          unit: 'mmol/L',
          referenceRange: {
            low: 3.5,
            high: 5.1,
            criticalLow: 2.8,
            criticalHigh: 6.2,
          },
        });

      expect(critRes.status).toBe(201);
      expect(critRes.body.data.flag).toBe('CRITICAL_HIGH');

      // Check that order status was automatically set to COMPLETED
      const updatedOrder = await OrderModel.findById(orderId);
      expect(updatedOrder?.status).toBe('COMPLETED');
    });

    it('records radiologist imaging report with structured impression', async () => {
      const imgRes = await request(app)
        .post(`/api/v1/patients/${patientId}/diagnostics/imaging`)
        .set('Authorization', `Bearer ${radiologistToken}`)
        .send({
          orderId,
          patientId,
          modality: 'XR',
          findings: 'Lungs are clear bilaterally without focal consolidation, pneumothorax, or large pleural effusion. Cardiac silhouette is within normal limits.',
          impression: 'Normal 2-view chest radiograph with no acute cardiopulmonary process.',
          isCritical: false,
        });

      expect(imgRes.status).toBe(201);
      expect(imgRes.body.data.status).toBe('FINAL');
      expect(imgRes.body.data.accessionNumber).toBeDefined();
    });
  });

  describe('Background SLA Sweeper', () => {
    it('detects overdue dispatch tasks and flags isBreached=true with audit event', async () => {
      // Create a dispatch task with slaDueAt set 1 hour in the past
      const pastSla = new Date(Date.now() - 60 * 60 * 1000);
      const overdueTask = await DispatchModel.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        patientId: new mongoose.Types.ObjectId(patientId),
        facilityId: new mongoose.Types.ObjectId(mockFacilityId),
        type: DISPATCH_TYPES.PATIENT_TRANSPORT,
        status: DISPATCH_STATUSES.IN_PROGRESS,
        priority: ORDER_PRIORITIES.STAT,
        fromDeptId: new mongoose.Types.ObjectId(fromDeptId),
        toDeptId: new mongoose.Types.ObjectId(toDeptId),
        slaMinutes: 15,
        slaDueAt: pastSla,
        isBreached: false,
        events: [
          {
            fromStatus: 'NONE',
            toStatus: DISPATCH_STATUSES.CREATED,
            timestamp: pastSla,
            actorId: new mongoose.Types.ObjectId(),
          },
        ],
      });

      // Run sweeper
      const breachedCount = await DispatchSlaSweeper.checkBreachedSlas();
      expect(breachedCount).toBeGreaterThanOrEqual(1);

      // Verify task in DB
      const refreshedTask = await DispatchModel.findById(overdueTask._id);
      expect(refreshedTask?.isBreached).toBe(true);
      expect(
        refreshedTask?.events.some((e) => e.reason?.includes('SLA Target Breached'))
      ).toBe(true);
    });
  });
});
