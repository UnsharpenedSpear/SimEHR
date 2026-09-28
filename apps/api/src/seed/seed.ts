/**
 * EHR System Seed Script
 *
 * Generates comprehensive realistic synthetic data:
 * - 9 system roles with correct permissions
 * - 1 facility + 10 departments
 * - 10 users (one per role)
 * - 300 patients with demographics, encrypted PHI, contacts
 * - ~600 encounters (2 per patient avg)
 * - ~900 vitals records
 * - ~400 clinical notes (SOAP)
 * - ~600 problems (ICD-10)
 * - ~400 allergies
 * - ~300 orders
 * - ~200 dispatches
 * - ~150 appointments
 * - ~120 invoices
 * - 15 procedure catalog entries
 *
 * Usage: npm run seed (from apps/api)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { hashPassword, encryptField, createBlindIndex } from '../utils/crypto.util.js';
import { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } from '@ehr/shared';

// Models
import { RoleModel } from '../modules/roles/role.model.js';
import { UserModel } from '../modules/users/user.model.js';
import { PatientModel } from '../modules/patients/patient.model.js';
import { CounterModel } from '../modules/patients/counter.model.js';
import { DepartmentModel } from '../modules/departments/department.model.js';
import { EncounterModel } from '../modules/encounters/encounter.model.js';
import { VitalsModel } from '../modules/vitals/vitals.model.js';
import { ClinicalNoteModel } from '../modules/clinical-notes/clinicalNote.model.js';
import { ProblemModel } from '../modules/problems/problem.model.js';
import { AllergyModel } from '../modules/allergies/allergy.model.js';
import { OrderModel } from '../modules/orders/order.model.js';
import { DispatchModel } from '../modules/dispatch/dispatch.model.js';
import { AppointmentModel } from '../modules/appointments/appointment.model.js';
import { InvoiceModel } from '../modules/billing/invoice.model.js';
import { ProcedureCatalogModel } from '../modules/procedures/procedureCatalog.model.js';
import { AuditLogModel } from '../modules/audit/auditLog.model.js';

// ─── Utility Helpers ────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randChoices<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomDob(): string {
  const year = randInt(1940, 2005);
  const month = String(randInt(1, 12)).padStart(2, '0');
  const day = String(randInt(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPhone(): string {
  return `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`;
}

function formatMrn(seq: number): string {
  return `MRN${String(seq).padStart(7, '0')}`;
}

function invoiceNumber(seq: number): string {
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}

// ─── Reference Data ──────────────────────────────────────────────────────────

const FIRST_NAMES_M = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas',
  'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven',
  'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald',
  'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Stephen',
];

const FIRST_NAMES_F = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Lisa', 'Nancy', 'Margaret', 'Betty', 'Sandra', 'Ashley', 'Emily',
  'Dorothy', 'Kimberly', 'Carol', 'Michelle', 'Amanda', 'Melissa', 'Deborah', 'Stephanie',
  'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
  'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
  'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez',
  'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright',
  'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker',
  'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Chen', 'Patel', 'Kim',
];

const CITIES = [
  'Springfield', 'Riverside', 'Lakewood', 'Fairview', 'Burlington', 'Georgetown',
  'Madison', 'Greenfield', 'Salem', 'Hillsdale', 'Clayton', 'Vernon', 'Kingston',
];

const STATES = ['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];

const ICD10_CODES = [
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'J44.1', description: 'COPD with acute exacerbation' },
  { code: 'N18.3', description: 'Chronic kidney disease, stage 3' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease, unspecified' },
  { code: 'F32.1', description: 'Major depressive disorder, single episode, moderate' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
  { code: 'M17.11', description: 'Primary osteoarthritis, right knee' },
  { code: 'G47.33', description: 'Obstructive sleep apnea' },
  { code: 'I48.91', description: 'Unspecified atrial fibrillation' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
  { code: 'N40.0', description: 'Benign prostatic hyperplasia' },
  { code: 'Z87.891', description: 'Personal history of nicotine dependence' },
  { code: 'R05.9', description: 'Cough, unspecified' },
  { code: 'K57.30', description: 'Diverticulosis of large intestine' },
  { code: 'S82.002A', description: 'Fracture of unspecified part of neck of femur, initial' },
];

const ALLERGENS = [
  'Penicillin', 'Amoxicillin', 'Aspirin', 'Ibuprofen', 'Sulfonamides', 'Codeine',
  'Morphine', 'Latex', 'Shellfish', 'Peanuts', 'Tree Nuts', 'Egg', 'Milk',
  'Erythromycin', 'Tetracycline', 'Vancomycin', 'Contrast Dye', 'Soy', 'Fish',
];

const REASONS_FOR_VISIT = [
  'Chest pain and shortness of breath',
  'Routine follow-up for hypertension',
  'Medication refill and blood pressure check',
  'Acute low back pain',
  'Fever and productive cough',
  'Dizziness and headache',
  'Abdominal pain and nausea',
  'Annual physical examination',
  'Post-operative follow-up',
  'Worsening dyspnea on exertion',
  'Uncontrolled blood glucose readings',
  'Syncope episode investigation',
  'Chest tightness and palpitations',
  'Urinary tract infection symptoms',
  'Knee pain and limited mobility',
];

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    RoleModel.deleteMany({}),
    UserModel.deleteMany({}),
    PatientModel.deleteMany({}),
    CounterModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    EncounterModel.deleteMany({}),
    VitalsModel.deleteMany({}),
    ClinicalNoteModel.deleteMany({}),
    ProblemModel.deleteMany({}),
    AllergyModel.deleteMany({}),
    OrderModel.deleteMany({}),
    DispatchModel.deleteMany({}),
    AppointmentModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    ProcedureCatalogModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);
  console.log('  ✅ Collections cleared');

  // ── 1. Roles ─────────────────────────────────────────────────────────────
  console.log('\n👥 Seeding roles...');
  const roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: 'System administrator with full access across all facilities',
    PHYSICIAN: 'Licensed physician with clinical documentation and prescribing privileges',
    NURSE: 'Registered nurse with clinical observation and care delivery privileges',
    RECEPTIONIST: 'Front desk staff for patient registration and scheduling',
    LAB_TECH: 'Laboratory technician for specimen processing and result entry',
    RADIOLOGIST: 'Diagnostic imaging specialist with report writing privileges',
    PHARMACIST: 'Licensed pharmacist for prescription verification and dispensing',
    BILLING_OFFICER: 'Billing staff for invoice management and payment processing',
    COMPLIANCE_AUDITOR: 'Compliance officer with read-only audit trail access',
  };

  const roleMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await RoleModel.create({
      name: roleName,
      permissions,
      isSystem: true,
      description: roleDescriptions[roleName] || roleName,
    });
    roleMap[roleName] = role._id as mongoose.Types.ObjectId;
  }
  console.log(`  ✅ Created ${Object.keys(roleMap).length} system roles`);

  // ── 2. Facility ID (synthetic ObjectId used across all documents) ────────
  const facilityId = new mongoose.Types.ObjectId();

  // ── 3. Departments ───────────────────────────────────────────────────────
  console.log('\n🏥 Seeding departments...');
  const deptData = [
    { name: 'Emergency Department', code: 'ED', type: 'CLINICAL' },
    { name: 'Internal Medicine', code: 'IM', type: 'CLINICAL' },
    { name: 'Cardiology', code: 'CARD', type: 'CLINICAL' },
    { name: 'Laboratory', code: 'LAB', type: 'DIAGNOSTIC' },
    { name: 'Radiology', code: 'RAD', type: 'DIAGNOSTIC' },
    { name: 'Pharmacy', code: 'PHARM', type: 'SUPPORT' },
    { name: 'Orthopedics', code: 'ORTHO', type: 'CLINICAL' },
    { name: 'Neurology', code: 'NEURO', type: 'CLINICAL' },
    { name: 'Intensive Care Unit', code: 'ICU', type: 'CLINICAL' },
    { name: 'Outpatient Clinic', code: 'OPC', type: 'CLINICAL' },
  ];

  const departments = await DepartmentModel.insertMany(
    deptData.map((d) => ({ ...d, facilityId }))
  );
  const deptIds = departments.map((d) => d._id as mongoose.Types.ObjectId);
  console.log(`  ✅ Created ${departments.length} departments`);

  // ── 4. Users ─────────────────────────────────────────────────────────────
  console.log('\n👤 Seeding users...');
  const defaultPasswordHash = await hashPassword('Password@123!');

  const userSeedData = [
    {
      email: 'admin@ehrtest.local',
      given: ['Alice'],
      family: 'Administrator',
      roleKey: SYSTEM_ROLES.SUPER_ADMIN,
      prefix: 'Ms.',
    },
    {
      email: 'dr.chen@ehrtest.local',
      given: ['Marcus'],
      family: 'Chen',
      roleKey: SYSTEM_ROLES.PHYSICIAN,
      prefix: 'Dr.',
      specialty: 'Internal Medicine',
      licenseNo: 'MD-20456',
      npi: '1234567890',
    },
    {
      email: 'dr.patel@ehrtest.local',
      given: ['Priya', 'S.'],
      family: 'Patel',
      roleKey: SYSTEM_ROLES.PHYSICIAN,
      prefix: 'Dr.',
      specialty: 'Cardiology',
      licenseNo: 'MD-30897',
      npi: '9876543210',
    },
    {
      email: 'nurse.williams@ehrtest.local',
      given: ['Sandra'],
      family: 'Williams',
      roleKey: SYSTEM_ROLES.NURSE,
      prefix: undefined,
    },
    {
      email: 'receptionist@ehrtest.local',
      given: ['Carlos'],
      family: 'Reyes',
      roleKey: SYSTEM_ROLES.RECEPTIONIST,
      prefix: undefined,
    },
    {
      email: 'labtech@ehrtest.local',
      given: ['Kevin'],
      family: 'Okonkwo',
      roleKey: SYSTEM_ROLES.LAB_TECH,
      prefix: undefined,
    },
    {
      email: 'radiologist@ehrtest.local',
      given: ['Helena'],
      family: 'Kowalski',
      roleKey: SYSTEM_ROLES.RADIOLOGIST,
      prefix: 'Dr.',
      specialty: 'Diagnostic Radiology',
      licenseNo: 'MD-40123',
    },
    {
      email: 'pharmacist@ehrtest.local',
      given: ['Omar'],
      family: 'Farouq',
      roleKey: SYSTEM_ROLES.PHARMACIST,
      prefix: undefined,
    },
    {
      email: 'billing@ehrtest.local',
      given: ['Rachel'],
      family: 'Nguyen',
      roleKey: SYSTEM_ROLES.BILLING_OFFICER,
      prefix: undefined,
    },
    {
      email: 'auditor@ehrtest.local',
      given: ['George'],
      family: 'Thornton',
      roleKey: SYSTEM_ROLES.COMPLIANCE_AUDITOR,
      prefix: undefined,
    },
  ];

  const createdUsers: any[] = [];
  for (const u of userSeedData) {
    const user = await UserModel.create({
      email: u.email,
      passwordHash: defaultPasswordHash,
      name: { given: u.given, family: u.family, prefix: u.prefix },
      roleIds: [roleMap[u.roleKey]],
      facilityIds: [facilityId],
      departmentIds: randChoices(deptIds, randInt(1, 3)),
      mfa: { enabled: false },
      status: 'ACTIVE',
      lockout: { count: 0 },
      forcePasswordChange: false,
      professional: u.specialty
        ? { specialty: (u as any).specialty, licenseNo: (u as any).licenseNo, npi: (u as any).npi }
        : undefined,
    });
    createdUsers.push({ ...u, _id: user._id });
  }

  const physicianIds = createdUsers
    .filter((u) => u.roleKey === SYSTEM_ROLES.PHYSICIAN)
    .map((u) => u._id as mongoose.Types.ObjectId);
  const nurseIds = createdUsers
    .filter((u) => u.roleKey === SYSTEM_ROLES.NURSE)
    .map((u) => u._id as mongoose.Types.ObjectId);
  const allClinicalIds = [...physicianIds, ...nurseIds];

  console.log(`  ✅ Created ${userSeedData.length} users`);
  console.log('\n  📋 Credentials (all passwords: Password@123!)');
  console.log('  ┌─────────────────────────────────────────┬──────────────────────┐');
  console.log('  │ Email                                   │ Role                 │');
  console.log('  ├─────────────────────────────────────────┼──────────────────────┤');
  for (const u of userSeedData) {
    console.log(`  │ ${u.email.padEnd(39)} │ ${u.roleKey.padEnd(20)} │`);
  }
  console.log('  └─────────────────────────────────────────┴──────────────────────┘');

  // ── 5. Procedure Catalog ─────────────────────────────────────────────────
  console.log('\n📋 Seeding procedure catalog...');
  const catalogEntries = [
    { code: 'CBC', name: 'Complete Blood Count', category: 'LABORATORY', price: 45, requiredPermission: 'order:create', defaultDurationMin: 60 },
    { code: 'CMP', name: 'Comprehensive Metabolic Panel', category: 'LABORATORY', price: 65, requiredPermission: 'order:create', defaultDurationMin: 60 },
    { code: 'LIPID', name: 'Lipid Panel', category: 'LABORATORY', price: 55, requiredPermission: 'order:create', defaultDurationMin: 60 },
    { code: 'HBA1C', name: 'Hemoglobin A1c', category: 'LABORATORY', price: 70, requiredPermission: 'order:create', defaultDurationMin: 30 },
    { code: 'UA', name: 'Urinalysis with Microscopy', category: 'LABORATORY', price: 35, requiredPermission: 'order:create', defaultDurationMin: 30 },
    { code: 'BCULTURE', name: 'Blood Culture x2', category: 'LABORATORY', price: 120, requiredPermission: 'order:create', defaultDurationMin: 120 },
    { code: 'CXR-PA', name: 'Chest X-Ray PA and Lateral', category: 'IMAGING', price: 180, requiredPermission: 'order:create', defaultDurationMin: 30 },
    { code: 'CT-HEAD', name: 'CT Head without Contrast', category: 'IMAGING', price: 850, requiredPermission: 'order:create', defaultDurationMin: 45 },
    { code: 'MRI-BRAIN', name: 'MRI Brain with Contrast', category: 'IMAGING', price: 1800, requiredPermission: 'order:create', defaultDurationMin: 90 },
    { code: 'ECHO', name: 'Transthoracic Echocardiogram', category: 'IMAGING', price: 950, requiredPermission: 'order:create', defaultDurationMin: 60 },
    { code: 'EKG', name: '12-Lead ECG', category: 'DIAGNOSTIC', price: 95, requiredPermission: 'order:create', defaultDurationMin: 15 },
    { code: 'SPIROM', name: 'Spirometry with Bronchodilator', category: 'DIAGNOSTIC', price: 145, requiredPermission: 'order:create', defaultDurationMin: 30 },
    { code: 'IV-ACCESS', name: 'Peripheral IV Catheter Insertion', category: 'THERAPEUTIC', price: 75, requiredPermission: 'procedure:perform_minor', defaultDurationMin: 15 },
    { code: 'SUTURE', name: 'Simple Wound Closure', category: 'THERAPEUTIC', price: 220, requiredPermission: 'procedure:perform_minor', defaultDurationMin: 30 },
    { code: 'LP', name: 'Lumbar Puncture', category: 'DIAGNOSTIC', price: 650, requiredPermission: 'procedure:perform_surgical', defaultDurationMin: 45 },
  ];

  const catalog = await ProcedureCatalogModel.insertMany(
    catalogEntries.map((e) => ({ ...e, active: true, codeSystem: 'CPT' }))
  );
  console.log(`  ✅ Created ${catalog.length} catalog entries`);

  // ── 6. Patients (300) ────────────────────────────────────────────────────
  console.log('\n🧑‍⚕️  Seeding 300 patients...');
  await CounterModel.create({ _id: 'mrn:FAC', seq: 300 });

  const PATIENT_COUNT = 300;
  const patientBatch: any[] = [];

  for (let i = 1; i <= PATIENT_COUNT; i++) {
    const isMale = Math.random() > 0.5;
    const firstName = randChoice(isMale ? FIRST_NAMES_M : FIRST_NAMES_F);
    const lastName = randChoice(LAST_NAMES);
    const phone = formatPhone();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(10, 99)}@example.com`;

    const encPhone = encryptField(phone);
    const phoneBlindIndex = createBlindIndex(phone.replace(/\D/g, ''));
    const encEmail = encryptField(email);
    const emailBlindIndex = createBlindIndex(email.toLowerCase());

    const nationalId = `${randInt(100, 999)}-${randInt(10, 99)}-${randInt(1000, 9999)}`;
    const encNationalId = encryptField(nationalId);
    const nationalIdBlindIndex = createBlindIndex(nationalId.replace(/\D/g, ''));

    const streetNum = randInt(100, 9999);
    const streetNames = ['Main St', 'Oak Ave', 'Elm Dr', 'Park Blvd', 'Lake Rd', 'River Way'];
    const encStreet = encryptField(`${streetNum} ${randChoice(streetNames)}`);

    patientBatch.push({
      mrn: formatMrn(i),
      facilityId,
      name: {
        given: [firstName],
        family: lastName,
        prefix: isMale && Math.random() > 0.7 ? 'Mr.' : !isMale && Math.random() > 0.7 ? 'Ms.' : undefined,
      },
      searchName: `${lastName.toLowerCase()} ${firstName.toLowerCase()}`,
      dob: randomDob(),
      sex: isMale ? 'MALE' : 'FEMALE',
      identifiers: [
        {
          type: 'NATIONAL_ID',
          value: encNationalId,
          issuer: 'SSA',
          blindIndex: nationalIdBlindIndex,
        },
      ],
      contact: {
        phones: [{ value: encPhone, blindIndex: phoneBlindIndex, isPrimary: true }],
        email: { value: encEmail, blindIndex: emailBlindIndex },
      },
      address: {
        street: encStreet,
        city: randChoice(CITIES),
        state: randChoice(STATES),
        postalCode: String(randInt(10000, 99999)),
        country: 'US',
      },
      emergencyContacts: [
        {
          name: `${randChoice(FIRST_NAMES_F)} ${lastName}`,
          relationship: randChoice(['Spouse', 'Parent', 'Sibling', 'Child']),
          phone: formatPhone(),
          isNextOfKin: true,
        },
      ],
      insurance: [
        {
          provider: randChoice(['BlueCross BlueShield', 'Aetna', 'United Health', 'Cigna', 'Humana', 'Medicare', 'Medicaid']),
          policyNumber: `POL-${randInt(100000, 999999)}`,
          subscriberName: `${firstName} ${lastName}`,
          relationship: 'SELF',
        },
      ],
      preferredLanguage: randChoice(['English', 'English', 'English', 'Spanish', 'Mandarin', 'French']),
      flags: {
        vip: Math.random() < 0.03,
        restricted: Math.random() < 0.05,
        deceased: Math.random() < 0.02,
      },
      codeStatus: randChoice(['FULL_CODE', 'FULL_CODE', 'FULL_CODE', 'DNR', 'DNR_DNI']),
      isolationFlags: Math.random() < 0.1 ? [randChoice(['CONTACT', 'DROPLET', 'AIRBORNE'])] : [],
      careTeam: [
        {
          userId: randChoice(allClinicalIds),
          role: 'PRIMARY',
          from: randDate(new Date('2024-01-01'), new Date()),
        },
      ],
      status: Math.random() < 0.02 ? 'INACTIVE' : 'ACTIVE',
    });
  }

  const patients = await PatientModel.insertMany(patientBatch);
  const patientIds = patients.map((p) => p._id as mongoose.Types.ObjectId);
  console.log(`  ✅ Created ${patients.length} patients`);

  // ── 7. Encounters ────────────────────────────────────────────────────────
  console.log('\n🏥 Seeding encounters...');
  const ENCOUNTER_TYPE_VALS = ['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'TELEHEALTH'];
  const ENCOUNTER_STATUS_VALS = ['IN_PROGRESS', 'COMPLETED', 'ARRIVED', 'TRIAGED', 'DISCHARGED'];

  const encounterBatch: any[] = [];
  for (const patientId of patientIds) {
    const numEncounters = randInt(1, 4);
    for (let e = 0; e < numEncounters; e++) {
      const type = randChoice(ENCOUNTER_TYPE_VALS);
      const start = randDate(new Date('2023-01-01'), new Date());
      const durationHours = randInt(1, type === 'INPATIENT' ? 168 : 8);
      const status = randChoice(ENCOUNTER_STATUS_VALS);
      const icd = randChoices(ICD10_CODES, randInt(1, 3));

      encounterBatch.push({
        patientId,
        facilityId,
        departmentId: randChoice(deptIds),
        type,
        status,
        start,
        end: status !== 'IN_PROGRESS' && status !== 'ARRIVED' && status !== 'TRIAGED'
          ? new Date(start.getTime() + durationHours * 3600000)
          : undefined,
        reasonForVisit: randChoice(REASONS_FOR_VISIT),
        diagnoses: icd.map((d, idx) => ({
          code: d.code,
          system: 'http://hl7.org/fhir/sid/icd-10',
          display: d.description,
          rank: idx + 1,
          isPrimary: idx === 0,
        })),
        attendingId: randChoice(physicianIds),
      });
    }
  }

  const encounters = await EncounterModel.insertMany(encounterBatch);
  const encounterIds = encounters.map((e) => e._id as mongoose.Types.ObjectId);
  console.log(`  ✅ Created ${encounters.length} encounters`);

  // ── 8. Vitals ────────────────────────────────────────────────────────────
  console.log('\n📊 Seeding vitals...');
  const vitalsBatch: any[] = [];

  for (const patientId of randChoices(patientIds, 250)) {
    const numVitals = randInt(2, 6);
    for (let v = 0; v < numVitals; v++) {
      const systolic = randInt(100, 180);
      const diastolic = randInt(60, 110);
      const hr = randInt(55, 115);
      const spo2 = randInt(91, 100);
      const tempC = parseFloat((randInt(365, 400) / 10).toFixed(1));
      const weightKg = randInt(50, 130);
      const heightCm = randInt(150, 195);
      const bmi = parseFloat((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1));

      const abnormalFlags: string[] = [];
      if (systolic >= 140 || diastolic >= 90) abnormalFlags.push('HYPERTENSION_STAGE_2');
      if (systolic >= 180 || diastolic >= 120) abnormalFlags.push('HYPERTENSIVE_CRISIS');
      if (hr > 100) abnormalFlags.push('TACHYCARDIA');
      if (hr < 60) abnormalFlags.push('BRADYCARDIA');
      if (spo2 < 95) abnormalFlags.push('HYPOXIA_MILD');
      if (spo2 < 90) abnormalFlags.push('HYPOXIA_CRITICAL');
      if (tempC >= 38.5) abnormalFlags.push('FEVER_HIGH');
      else if (tempC >= 37.8) abnormalFlags.push('FEVER_LOW');

      vitalsBatch.push({
        patientId,
        recordedAt: randDate(new Date('2023-01-01'), new Date()),
        recordedBy: randChoice(allClinicalIds),
        bp: { systolic, diastolic },
        hr,
        rr: randInt(12, 24),
        tempC,
        spo2,
        weightKg,
        heightCm,
        bmi,
        painScore: randInt(0, 10),
        abnormalFlags,
      });
    }
  }

  await VitalsModel.insertMany(vitalsBatch);
  console.log(`  ✅ Created ${vitalsBatch.length} vitals records`);

  // ── 9. Clinical Notes ────────────────────────────────────────────────────
  console.log('\n📝 Seeding clinical notes...');
  const notesBatch: any[] = [];

  const soapTemplates = [
    {
      subjective: 'Patient presents with worsening shortness of breath on exertion for 3 days. Non-productive cough. Denies fever or chest pain at rest.',
      objective: 'BP 148/92 mmHg, HR 88 bpm, RR 18/min, SpO2 94% on room air. Bilateral crackles at bases. JVD present.',
      assessment: 'Acute decompensated heart failure, likely dietary sodium non-compliance. Fluid overload evident.',
      plan: 'IV furosemide 40mg. Fluid restriction 1.5L/day. Daily weights. Echocardiogram ordered. Cardiology consult placed.',
    },
    {
      subjective: 'Patient reports blood glucose consistently above 250 mg/dL despite compliance with oral hypoglycemics. Increased thirst and urination.',
      objective: 'Random glucose 287 mg/dL, HbA1c 9.8%. BP 132/84 mmHg. BMI 31.2. Sensation intact bilaterally.',
      assessment: 'Poorly controlled type 2 diabetes mellitus (E11.65). Consider insulin initiation.',
      plan: 'Initiate basal insulin glargine 10 units nightly. Continue metformin 1000mg BID. Diabetes education referral. Repeat HbA1c in 3 months.',
    },
    {
      subjective: 'Follow-up for essential hypertension. Reports occasional morning headaches. Currently on amlodipine 5mg daily.',
      objective: 'BP 138/86 mmHg (repeated x2), HR 72 bpm. No peripheral edema. Lungs clear. BMI 27.4.',
      assessment: 'Essential hypertension (I10), inadequately controlled on monotherapy.',
      plan: 'Titrate amlodipine to 10mg daily. Low-sodium DASH diet reinforced. Home BP log requested.',
    },
    {
      subjective: 'Patient with COPD presenting with increased dyspnea, worsening cough with purulent sputum production over 5 days.',
      objective: 'SpO2 88% on room air, improving to 94% on 2L O2. Diffuse expiratory wheeze. Respiratory rate 24/min.',
      assessment: 'COPD exacerbation (J44.1), likely infectious trigger. Requires admission.',
      plan: 'Admit for IV antibiotics, systemic corticosteroids. Nebulized bronchodilators q4h. Respiratory therapy consult.',
    },
  ];

  const sampledEncounters = randChoices(encounters as any[], Math.min(encounters.length, 350));
  for (const enc of sampledEncounters) {
    const template = randChoice(soapTemplates);
    const status = randChoice(['DRAFT', 'SIGNED', 'SIGNED', 'SIGNED']);
    const authorId = randChoice(physicianIds);
    const createdAt = new Date((enc.start as Date).getTime() + randInt(30, 120) * 60000);

    notesBatch.push({
      patientId: enc.patientId,
      encounterId: enc._id,
      authorId,
      template: 'SOAP',
      title: randChoice(['Progress Note', 'Admission Note', 'Discharge Summary', 'Consultation Note', 'Follow-up Note']),
      content: {
        subjective: template.subjective,
        objective: template.objective,
        assessment: template.assessment,
        plan: template.plan,
      },
      status,
      version: 1,
      signedAt: status === 'SIGNED' ? new Date(createdAt.getTime() + randInt(5, 30) * 60000) : undefined,
      signedBy: status === 'SIGNED' ? authorId : undefined,
    });
  }

  await ClinicalNoteModel.insertMany(notesBatch);
  console.log(`  ✅ Created ${notesBatch.length} clinical notes`);

  // ── 10. Problems ─────────────────────────────────────────────────────────
  console.log('\n🩺 Seeding problems...');
  const problemsBatch: any[] = [];

  for (const patientId of patientIds) {
    const numProblems = randInt(1, 4);
    const selectedIcds = randChoices(ICD10_CODES, numProblems);
    for (const icd of selectedIcds) {
      const isResolved = Math.random() < 0.15;
      problemsBatch.push({
        patientId,
        icd10: icd.code,
        description: icd.description,
        status: isResolved ? 'RESOLVED' : randChoice(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']),
        onset: randDate(new Date('2018-01-01'), new Date()).toISOString().split('T')[0],
        resolvedAt: isResolved ? randDate(new Date('2022-01-01'), new Date()).toISOString().split('T')[0] : undefined,
        recordedBy: randChoice(physicianIds),
      });
    }
  }

  await ProblemModel.insertMany(problemsBatch);
  console.log(`  ✅ Created ${problemsBatch.length} problems`);

  // ── 11. Allergies ────────────────────────────────────────────────────────
  console.log('\n⚠️  Seeding allergies...');
  const allergyBatch: any[] = [];

  for (const patientId of randChoices(patientIds, 200)) {
    const substances = randChoices(ALLERGENS, randInt(1, 3));
    for (const substance of substances) {
      allergyBatch.push({
        patientId,
        substance,
        category: randChoice(['MEDICATION', 'MEDICATION', 'FOOD', 'ENVIRONMENTAL', 'OTHER']),
        reactions: randChoices(['Urticaria', 'Anaphylaxis', 'Rash', 'Pruritus', 'Angioedema', 'Nausea', 'Dyspnea'], randInt(1, 3)),
        severity: randChoice(['MILD', 'MODERATE', 'MODERATE', 'SEVERE']),
        status: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        onset: randDate(new Date('2010-01-01'), new Date()).toISOString().split('T')[0],
        recordedBy: randChoice(allClinicalIds),
      });
    }
  }

  await AllergyModel.insertMany(allergyBatch);
  console.log(`  ✅ Created ${allergyBatch.length} allergies`);

  // ── 12. Orders ───────────────────────────────────────────────────────────
  console.log('\n📋 Seeding orders...');
  const ORDER_TYPE_VALS = ['LAB', 'IMAGING', 'MEDICATION', 'PROCEDURE', 'REFERRAL'];
  const ORDER_STATUS_VALS = ['ORDERED', 'ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  const orderBatch: any[] = [];
  const sampledEncountersForOrders = randChoices(encounters as any[], 300);

  for (const enc of sampledEncountersForOrders) {
    const type = randChoice(ORDER_TYPE_VALS);
    const clinicianId = randChoice(physicianIds);
    const createdAt = randDate(new Date((enc.start as Date).getTime()), new Date());
    const status = randChoice(ORDER_STATUS_VALS);

    orderBatch.push({
      patientId: enc.patientId,
      encounterId: enc._id,
      type,
      name: randChoice([
        'Complete blood count with differential',
        'Comprehensive metabolic panel',
        'Chest X-Ray PA/Lateral',
        'CT Head without contrast',
        'Transthoracic echocardiogram',
        'Cardiology consultation',
        'IV furosemide 40mg bolus',
        'Prothrombin time and INR',
        'Urine culture and sensitivity',
        'Blood cultures x2',
        '12-Lead ECG',
        'Physical therapy evaluation',
      ]),
      indication: randChoice(REASONS_FOR_VISIT),
      priority: randChoice(['ROUTINE', 'ROUTINE', 'URGENT', 'STAT']),
      status,
      orderedBy: clinicianId,
      destinationDeptId: randChoice(deptIds),
      signedAt: status !== 'DRAFT' ? new Date(createdAt.getTime() + randInt(5, 20) * 60000) : undefined,
      createdAt,
    });
  }

  const orders = await OrderModel.insertMany(orderBatch);
  console.log(`  ✅ Created ${orders.length} orders`);

  // ── 13. Dispatches ───────────────────────────────────────────────────────
  console.log('\n🚚 Seeding dispatches...');
  const DISPATCH_TYPE_VALS = [
    'LAB_SPECIMEN', 'PHARMACY_PRESCRIPTION', 'RADIOLOGY_REQUEST',
    'WARD_BED_TRANSFER', 'PATIENT_TRANSPORT',
  ];
  const DISPATCH_STATUS_VALS = ['CREATED', 'DISPATCHED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];

  const slaMap: Record<string, number> = {
    STAT: 30, URGENT: 120, ROUTINE: 480,
  };

  const dispatchBatch: any[] = [];
  const sampledOrders = randChoices(orders as any[], 200);

  for (const order of sampledOrders) {
    const dispatchType = randChoice(DISPATCH_TYPE_VALS);
    const priority = (order.priority as string) || 'ROUTINE';
    const slaMinutes = slaMap[priority] || 240;
    const createdAt = new Date((order.createdAt as Date).getTime() + randInt(5, 30) * 60000);
    const slaDueAt = new Date(createdAt.getTime() + slaMinutes * 60000);
    const status = randChoice(DISPATCH_STATUS_VALS);
    const isCompleted = status === 'COMPLETED';
    const isBreached = !isCompleted && slaDueAt < new Date();

    const events: any[] = [
      {
        fromStatus: 'CREATED',
        toStatus: 'CREATED',
        timestamp: createdAt,
        actorId: randChoice(physicianIds),
      },
    ];

    if (status !== 'CREATED') {
      events.push({
        fromStatus: 'CREATED',
        toStatus: 'DISPATCHED',
        timestamp: new Date(createdAt.getTime() + randInt(2, 10) * 60000),
        actorId: randChoice(physicianIds),
      });
    }
    if (isCompleted) {
      events.push({
        fromStatus: 'DISPATCHED',
        toStatus: 'COMPLETED',
        timestamp: new Date(createdAt.getTime() + randInt(slaMinutes * 0.3, slaMinutes * 0.9) * 60000),
        actorId: randChoice(allClinicalIds),
      });
    }

    dispatchBatch.push({
      orderId: order._id,
      patientId: order.patientId,
      facilityId,
      type: dispatchType,
      status,
      priority,
      fromDeptId: randChoice(deptIds),
      toDeptId: randChoice(deptIds),
      slaMinutes,
      slaDueAt,
      isBreached,
      events,
      createdAt,
    });
  }

  await DispatchModel.insertMany(dispatchBatch);
  console.log(`  ✅ Created ${dispatchBatch.length} dispatches`);

  // ── 14. Appointments ─────────────────────────────────────────────────────
  console.log('\n📅 Seeding appointments...');
  const APPT_STATUS_VALS = ['SCHEDULED', 'SCHEDULED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  const APPT_TYPE_VALS = ['ROUTINE', 'FOLLOW_UP', 'NEW_PATIENT', 'PROCEDURE', 'TELEHEALTH'];

  const apptBatch: any[] = [];
  for (let a = 0; a < 150; a++) {
    const patientId = randChoice(patientIds);
    const start = randDate(new Date('2025-01-01'), new Date('2026-12-31'));
    const durationMin = randChoice([15, 30, 45, 60]);
    const status = randChoice(APPT_STATUS_VALS);

    apptBatch.push({
      patientId,
      facilityId,
      departmentId: randChoice(deptIds),
      providerId: randChoice(physicianIds),
      type: randChoice(APPT_TYPE_VALS),
      status,
      start,
      end: new Date(start.getTime() + durationMin * 60000),
      durationMin,
      reason: randChoice(REASONS_FOR_VISIT),
      notes: Math.random() > 0.75 ? 'Patient may require interpreter services' : undefined,
      checkedInAt: status === 'ARRIVED' || status === 'COMPLETED' ? new Date(start.getTime() - randInt(5, 15) * 60000) : undefined,
      completedAt: status === 'COMPLETED' ? new Date(start.getTime() + durationMin * 60000) : undefined,
    });
  }

  await AppointmentModel.insertMany(apptBatch);
  console.log(`  ✅ Created ${apptBatch.length} appointments`);

  // ── 15. Invoices ─────────────────────────────────────────────────────────
  console.log('\n💰 Seeding invoices...');
  const INVOICE_STATUS_VALS = ['ISSUED', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'];

  const invoiceBatch: any[] = [];
  const sampledEncountersForInvoices = randChoices(encounters as any[], 120);

  let invoiceSeq = 1;
  for (const enc of sampledEncountersForInvoices) {
    const lineItems = randChoices(catalogEntries, randInt(1, 4)).map((item) => ({
      code: item.code,
      description: item.name,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
    }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);
    const taxAmount = parseFloat((subtotal * 0.08).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
    const status = randChoice(INVOICE_STATUS_VALS);
    const amountPaid =
      status === 'PAID'
        ? totalAmount
        : status === 'PARTIALLY_PAID'
          ? parseFloat((totalAmount * (0.3 + Math.random() * 0.4)).toFixed(2))
          : 0;
    const balanceDue = parseFloat((totalAmount - amountPaid).toFixed(2));

    invoiceBatch.push({
      invoiceNumber: invoiceNumber(invoiceSeq++),
      patientId: enc.patientId,
      encounterId: enc._id,
      facilityId,
      status,
      lineItems,
      subtotal,
      taxAmount,
      totalAmount,
      amountPaid,
      balanceDue,
      payer: {
        type: randChoice(['INSURANCE', 'INSURANCE', 'SELF_PAY']),
        policyNumber: `POL-${randInt(100000, 999999)}`,
      },
    });
  }

  await InvoiceModel.insertMany(invoiceBatch);
  console.log(`  ✅ Created ${invoiceBatch.length} invoices`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n🎉 ─────────────────────────────────────────────────────────────');
  console.log('🎉  EHR Seed Complete!');
  console.log('🎉 ─────────────────────────────────────────────────────────────');
  const summary = [
    ['Roles',        Object.keys(roleMap).length],
    ['Users',        userSeedData.length],
    ['Departments',  departments.length],
    ['Catalog',      `${catalog.length} procedures`],
    ['Patients',     patients.length],
    ['Encounters',   encounters.length],
    ['Vitals',       vitalsBatch.length],
    ['Notes',        notesBatch.length],
    ['Problems',     problemsBatch.length],
    ['Allergies',    allergyBatch.length],
    ['Orders',       orders.length],
    ['Dispatches',   dispatchBatch.length],
    ['Appointments', apptBatch.length],
    ['Invoices',     invoiceBatch.length],
  ];

  for (const [label, value] of summary) {
    console.log(`   ${String(label).padEnd(14)} ${value}`);
  }

  console.log('\n   ▶  docker compose up -d');
  console.log('   ▶  cd apps/api  && npm run dev');
  console.log('   ▶  cd apps/web  && npm run dev\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
