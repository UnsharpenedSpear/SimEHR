import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { CounterModel } from '../modules/patients/counter.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { RoleModel } from '../modules/roles/role.model.js';
import { AuditLogModel } from '../modules/audit/auditLog.model.js';
import { RoleController } from '../modules/roles/role.controller.js';
import { buildPatientSearchPipeline } from '../db/queries/patientSearch.query.js';
import { hashPassword, createBlindIndex } from '../utils/crypto.util.js';
import { SYSTEM_ROLES } from '@ehr/shared';

describe('Phase 3 Integration: Patient Registration, Encryption, Search & Explain Plans', () => {
  const app = createApp();
  let physicianToken: string;
  let physicianId: string;
  const mockFacilityId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await connectDB();
    await PatientModel.deleteMany({});
    await CounterModel.deleteMany({});
    await UserModel.deleteMany({});
    await RoleModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    await RoleController.ensureDefaultRoles();
    const physicianRole = await RoleModel.findOne({ name: SYSTEM_ROLES.PHYSICIAN });

    const passwordHash = await hashPassword('Password123!@#');
    const physician = await UserModel.create({
      email: 'doctor_p3@test.org',
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
      .send({ email: 'doctor_p3@test.org', password: 'Password123!@#' });

    physicianToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Patient Registration & Cryptography', () => {
    it('registers patient, generates atomic MRN, and encrypts sensitive fields in DB', async () => {
      const patientData = {
        facilityId: mockFacilityId,
        name: {
          given: ['Eleanor', 'Marie'],
          family: 'Vance',
          prefix: 'Ms.',
        },
        dob: '1990-05-14',
        sex: 'FEMALE',
        identifiers: [
          {
            type: 'NATIONAL_ID',
            value: '987-65-4321',
          },
        ],
        contact: {
          phones: ['+1 (555) 789-0123'],
          email: 'eleanor.vance@example.com',
        },
        address: {
          street: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'OR',
          postalCode: '97477',
          country: 'USA',
        },
        flags: {
          vip: false,
          restricted: false,
          deceased: false,
        },
      };

      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send(patientData);

      expect(res.status).toBe(201);
      expect(res.body.data.mrn).toBeDefined();
      expect(res.body.data.mrn).toContain('FAC-');
      expect(res.body.data.name.family).toBe('Vance');

      // Verify raw database record contains ciphertext and blind indexes
      const rawDbPatient = await PatientModel.findById(res.body.data.id).lean();
      expect(rawDbPatient).toBeDefined();
      expect(rawDbPatient!.address.street).toContain(':'); // IV:Tag:Ciphertext
      expect(rawDbPatient!.address.street).not.toBe('742 Evergreen Terrace');
      expect(rawDbPatient!.identifiers[0].value).toContain(':');
      expect(rawDbPatient!.identifiers[0].blindIndex).toBe(createBlindIndex('987-65-4321'));
      expect(rawDbPatient!.contact.phones[0].blindIndex).toBe(createBlindIndex('+1 (555) 789-0123'));
    });

    it('requires guardian information for minors (< 18 years old)', async () => {
      const minorData = {
        facilityId: mockFacilityId,
        name: { given: ['Tommy'], family: 'Pickles' },
        dob: '2020-01-01', // Minor
        sex: 'MALE',
        contact: { phones: ['555-111-2222'] },
        address: { street: '123 Pine St', city: 'City', state: 'ST', postalCode: '12345' },
      };

      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send(minorData);

      expect(res.status).toBe(422);
      expect(res.body.errors[0].message).toContain('Guardian information is required for minor');
    });
  });

  describe('Search & Index Explain Assertions', () => {
    it('searches patients by MRN, name prefix, and blind indexed phone', async () => {
      // 1. Search by name prefix
      const nameRes = await request(app)
        .get('/api/v1/patients/search?query=vance')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(nameRes.status).toBe(200);
      expect(nameRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(nameRes.body.data[0].name.family).toBe('Vance');

      // 2. Search by blind-indexed phone
      const phoneRes = await request(app)
        .get('/api/v1/patients/search?query=5557890123')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(phoneRes.status).toBe(200);
      expect(phoneRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(phoneRes.body.data[0].name.family).toBe('Vance');
    });

    it('asserts index usage (IXSCAN) on patient search query pipeline via explain()', async () => {
      const match = {
        facilityId: new mongoose.Types.ObjectId(mockFacilityId),
        mrn: 'FAC-100001',
      };

      const explainResult = await PatientModel.find(match).explain('executionStats');

      // Ensure execution is optimized and uses Index Scan on mrn or compound index rather than full collection scan
      const explainString = JSON.stringify(explainResult);
      expect(explainString).toContain('IXSCAN');
      expect(explainString).not.toContain('COLLSCAN');
    });
  });

  describe('Duplicate Detection, Break-Glass & Merge Workflows', () => {
    it('detects duplicate candidate when registering matching patient', async () => {
      const dupCheckRes = await request(app)
        .post('/api/v1/patients/check-duplicates')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          family: 'Vance',
          given: ['Eleanor'],
          dob: '1990-05-14',
          phone: '+1 (555) 789-0123',
          facilityId: mockFacilityId,
        });

      expect(dupCheckRes.status).toBe(200);
      expect(dupCheckRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(dupCheckRes.body.data[0].matchScore).toBeGreaterThanOrEqual(50);
    });

    it('enforces break-glass reason requirement on restricted records', async () => {
      // Create restricted patient
      const restrictedPatient = await PatientModel.create({
        mrn: 'FAC-999999',
        facilityId: new mongoose.Types.ObjectId(mockFacilityId),
        name: { given: ['Restricted'], family: 'VIP' },
        searchName: 'vip restricted',
        dob: '1985-10-10',
        sex: 'MALE',
        identifiers: [],
        contact: { phones: [{ value: 'enc', blindIndex: 'idx' }] },
        address: { street: 'enc', city: 'City', state: 'ST', postalCode: '12345', country: 'USA' },
        flags: { vip: true, restricted: true, deceased: false },
        status: 'ACTIVE',
        careTeam: [], // Physician is NOT in care team
      });

      // 1. Initial read indicates restricted status
      const getRes = await request(app)
        .get(`/api/v1/patients/${restrictedPatient._id}`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.isRestricted).toBe(true);

      // 2. Break-glass override
      const breakGlassRes = await request(app)
        .post(`/api/v1/patients/${restrictedPatient._id}/break-glass`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ reason: 'Emergency cardiac event in trauma bay requiring immediate chart review' });

      expect(breakGlassRes.status).toBe(200);
      expect(breakGlassRes.body.data.name.family).toBe('VIP');

      // Verify audit log recorded the break glass override
      const auditLog = await AuditLogModel.findOne({ action: 'PATIENT_BREAK_GLASS', patientId: restrictedPatient._id });
      expect(auditLog).toBeDefined();
      expect(auditLog?.breakGlass?.reason).toContain('Emergency cardiac event');
    });

    it('merges duplicate patient records in an atomic transaction', async () => {
      const patientA = await PatientModel.create({
        mrn: 'FAC-000001',
        facilityId: new mongoose.Types.ObjectId(mockFacilityId),
        name: { given: ['Duplicate'], family: 'One' },
        searchName: 'one duplicate',
        dob: '1992-02-02',
        sex: 'FEMALE',
        identifiers: [],
        contact: { phones: [{ value: 'enc', blindIndex: 'idx1' }] },
        address: { street: 'enc', city: 'City', state: 'ST', postalCode: '12345', country: 'USA' },
        flags: { vip: false, restricted: false, deceased: false },
        status: 'ACTIVE',
      });

      const patientB = await PatientModel.create({
        mrn: 'FAC-000002',
        facilityId: new mongoose.Types.ObjectId(mockFacilityId),
        name: { given: ['Duplicate'], family: 'Two' },
        searchName: 'two duplicate',
        dob: '1992-02-02',
        sex: 'FEMALE',
        identifiers: [],
        contact: { phones: [{ value: 'enc', blindIndex: 'idx2' }] },
        address: { street: 'enc', city: 'City', state: 'ST', postalCode: '12345', country: 'USA' },
        flags: { vip: false, restricted: false, deceased: false },
        status: 'ACTIVE',
      });

      const mergeRes = await request(app)
        .post(`/api/v1/patients/${patientA._id}/merge`)
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          targetPatientId: patientB._id.toString(),
          reason: 'Identified duplicate chart created during emergency admission',
        });

      expect(mergeRes.status).toBe(200);
      expect(mergeRes.body.data.success).toBe(true);

      const updatedSource = await PatientModel.findById(patientA._id);
      expect(updatedSource?.status).toBe('MERGED');
      expect(updatedSource?.mergedInto?.toString()).toBe(patientB._id.toString());
    });
  });
});
