# Simulated EHR System — Technical Presentation & Architecture Deck

**Title:** Simulated Electronic Health Record (EHR) System  
**Topic:** End-to-End System Architecture, Cryptographic Safeguards, Data Modeling, and Real-Time Clinical Workflows  
**Format:** Slide Deck & Presenter Notes Guide

---

## Slide 1: Project Overview & Architecture

### Simulated Electronic Health Record (EHR)
#### *An Enterprise-Grade, HIPAA-Compliant Clinical Workflow & Management Platform*

* **Architecture:** Full-Stack Monorepo (Node.js 20, TypeScript 5.7, Express, React 19, MongoDB 7.0 Replica Set, Redis 7.0)
* **Core Standards:** HIPAA Security Rule (§ 164.312), HL7 FHIR Release 4, RFC 7807 Problem Details, RFC 6238 (TOTP MFA)
* **Key Features:** Field-Level AES-256-GCM Encryption, HMAC-SHA256 Blind Indexing, SHA-256 Hash-Chained Audit Ledger, Real-Time Dispatch FSM, Clinical Decision Support (CDS)

> 🎙️ **Presenter Notes:**  
> "Welcome. Today we're reviewing the Simulated EHR System — a full-stack electronic health record and hospital workflow application built with Node.js, Express, React 19, TypeScript, MongoDB, and Redis."

---

## Slide 2: What is an EHR & What Problems Does This Solve?

### Real-World Clinical & Security Challenges

1. **Protecting Sensitive Patient Data (PHI):** Traditional systems store patient records in plaintext or rely only on disk encryption. If database dumps or replication logs leak, raw SSNs and names are exposed. This system encrypts sensitive fields individually at the application layer using AES-256-GCM.
2. **The Encrypted Search Problem:** Strong encryption generates random ciphertext, which breaks standard database indexes. We use deterministic HMAC-SHA256 blind indexes so exact lookups (by SSN, phone, or email) execute in $O(1)$ time without decrypting the entire database.
3. **Audit Log Integrity:** Database administrators can silently edit or delete traditional audit logs. Our system cryptographically chains each audit entry with a SHA-256 hash of the previous record.
4. **Clinical Safety & Hospital Flow:** Real-time checking for dangerous drug interactions (CDS), calendar conflict prevention, and live task coordination for moving patients and lab specimens.

> 🎙️ **Presenter Notes:**  
> "Electronic Health Records have three big challenges: securing sensitive patient data against database leaks, searching encrypted data quickly without decrypting everything, and coordinating fast, error-free clinical workflows."

---

## Slide 3: Complete Technology Stack

### End-to-End TypeScript Monorepo

* **Frontend (`apps/web`):**
  - React 18/19 & TypeScript 5.7 with Vite 6 (hot reload & optimized bundling).
  - Material-UI (MUI v6) with Google Material Design 3 (M3) design tokens and themes.
  - Zustand for client authentication and active patient context.
  - TanStack React Query for server-side caching and automatic background revalidation.
  - Recharts for longitudinal vitals trends.
  - Socket.IO Client for real-time dispatch updates and SLA alerts.

* **Backend (`apps/api`):**
  - Node.js 20 & Express 4 in TypeScript.
  - MongoDB 7.0 (configured as a single-node replica set) with Mongoose 8 for multi-document transactions and atomic counters.
  - Redis 7.0 for sliding-window rate limiting and refresh token storage.
  - Socket.IO Server for real-time department broadcasting channels.
  - Pino for high-speed structured JSON logging.
  - Vitest with `mongodb-memory-server` for zero-dependency integration tests.

* **Shared Domain Layer (`packages/shared`):**
  - Zod validation schemas shared between frontend forms and backend endpoints.
  - 9 System roles and 37 granular permission definitions.
  - Clinical code taxonomies: ICD-10, RxNorm, LOINC, and CPT.

> 🎙️ **Presenter Notes:**  
> "The stack is 100% TypeScript. We use React 19 and Material Design 3 on the frontend, Node.js and Express with MongoDB Replica Sets and Redis on the backend, and shared Zod schemas in packages/shared."

---

## Slide 4: Monorepo Organization & Inbound Pipeline

### Directory Structure & Request Processing

```
packages/
  shared/                 # Zod validation schemas, roles, codes
apps/
  api/
    src/
      modules/            # Modular domain services (patients, chart, orders, billing, etc.)
      middleware/         # Auth, RBAC, audit, rate limit, validation, RFC 7807
      realtime/           # Socket.IO department rooms
      jobs/               # Dispatch SLA background sweeper
      seed/               # 300-patient synthetic seeder
  web/
    src/
      features/           # Chart, Dispatch, Patients, Appointments, Admin, Reports
      components/         # AppShell, NavRail, PatientBanner
      stores/             # authStore, uiStore
      theme/              # Material Design 3 tokens
docs/                     # Comprehensive technical documentation
```

### Inbound API Request Pipeline
1. **Pino Logger:** Injects trace IDs and logs structured JSON.
2. **Redis Rate Limiter:** Enforces token bucket limits on IP and auth routes.
3. **CORS & Security:** Standard security headers.
4. **JWT Authn:** Validates access tokens and populates user session.
5. **RBAC & Facility ABAC Guard:** Verifies required permissions and `X-Facility-Id`.
6. **Idempotency Filter:** Deduplicates requests with `X-Idempotency-Key`.
7. **Zod Validator:** Strongly validates body, query, and params.
8. **Domain Service:** Executes business logic and cryptographic operations.
9. **SHA-256 Audit Interceptor:** Automatically records hash-chained audit entry.
10. **RFC 7807 Error Handler:** Catches exceptions and returns standardized Problem Details.

> 🎙️ **Presenter Notes:**  
> "The monorepo enforces clean boundaries. Inbound API requests go through a 10-step security pipeline handling rate limiting, auth, facility scoping, idempotency, validation, and hash-chain auditing."

---

## Slide 5: Authentication, 9 Roles & Multi-Tenancy

### Identity & Access Control

* **Argon2id Password Hashing:** 64 MB memory cost, 3 iterations, 4 threads for brute-force resistance.
* **TOTP Multi-Factor Authentication:** RFC 6238 6-digit dynamic codes with 30-second time-steps.
* **Rotating Refresh Token Families:** Short-lived 15-minute JWT access tokens + rotating refresh tokens. If an expired or replayed refresh token is detected, the server **instantly revokes the entire token family**.
* **9 Clinical Roles across 37 Permissions:**
  - `SUPER_ADMIN`, `PHYSICIAN`, `NURSE`, `RECEPTIONIST`, `LAB_TECH`, `RADIOLOGIST`, `PHARMACIST`, `BILLING_OFFICER`, `COMPLIANCE_AUDITOR`.
* **Multi-Facility Tenancy:** Scoped via mandatory `X-Facility-Id` request header.
* **Break-Glass Emergency Protocol:** In life-threatening emergencies, clinicians can supply `X-Break-Glass-Reason` to override ward restrictions, automatically generating a high-priority compliance audit event.

> 🎙️ **Presenter Notes:**  
> "Authentication uses Argon2id password hashing, RFC 6238 TOTP MFA, and single-use refresh token families. There are 9 distinct roles with 37 permissions, plus an emergency Break-Glass protocol."

---

## Slide 6: Field-Level Encryption & Deterministic Blind Indexing

### Solving the Encrypted Search Paradox

```json
{
  "_id": "6740a1b2c3d4e5f6a7b8c9d0",
  "mrn": "MRN-MAIN-202609-00042",
  "ssn": {
    "ciphertext": "8f3b2a19...",
    "iv": "d4e5f6a7...",
    "tag": "1a2b3c4d..."
  },
  "ssnBlindIndex": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

* **AES-256-GCM Envelope Encryption:** Sensitive identifiers (SSN, legal name, phone, email, address) are encrypted before reaching the database driver. Every field gets a unique random 12-byte IV and 16-byte GCM authentication tag.
* **HMAC-SHA256 Blind Indexing:**
  $$\text{blindIndex} = \text{HMAC-SHA256}(\text{normalize}(\text{plaintext}), \, \text{BLIND\_INDEX\_SALT})$$
  The hash is stored in a MongoDB B-Tree index, enabling **$O(1)$ sub-millisecond equality searches** by SSN, phone, or email without decrypting unauthorized records.

> 🎙️ **Presenter Notes:**  
> "Sensitive fields like SSN, phone, and name are encrypted with AES-256-GCM. To search without decrypting every record, we create deterministic HMAC-SHA256 blind indexes with an isolated salt."

---

## Slide 7: Clinical Chart, Signed SOAP Notes & Vitals Outliers

### Doctor Charting & Automated Clinical Alerts

* **Encounters:** Outpatient (OPD), Inpatient (IPD), Emergency (ER), and Telehealth visits.
* **SOAP Notes:** Subjective, Objective, Assessment, Plan documentation.
* **Digital Signatures & Immutability:** Notes signed with the physician's PIN are sealed and cannot be modified. Additions require formal **Amendment Addenda**.
* **Automated Vitals Computing:**
  - Automatic **BMI calculation** and category classification.
  - **Outlier Detection:** Abnormal vitals (Systolic > 180, SpO2 < 90%) trigger high-visibility alerts on clinical workstations.
* **Problem List & Allergies:** Coded to standard **ICD-10-CM** categories with severity levels.

> 🎙️ **Presenter Notes:**  
> "Clinicians document encounters with SOAP notes and digital signatures. The vitals engine computes BMI and automatically flags outlier readings like extreme blood pressure or low oxygen."

---

## Slide 8: Clinical Orders & 7 Polymorphic Discriminators

### Polymorphic Schemas in MongoDB

Why use discriminators? Clinical orders share common tracking fields (`patientId`, `encounterId`, `status`, `priority`) but require different domain payloads. Mongoose discriminators allow all 7 order types to live in a single indexed collection:

1. **`LabOrder`**: Specimen collection requirements, lab test codes, and reference intervals.
2. **`ImagingOrder`**: Modality (X-Ray, CT, MRI), anatomical site, contrast flags.
3. **`NursingOrder`**: Shift care plan tasks and frequency.
4. **`ConsultOrder`**: Specialty department referrals and clinical questions.
5. **`DietaryOrder`**: Clinical nutrition protocols.
6. **`MinorProcedure`**: Bedside procedures (e.g. laceration repair).
7. **`SurgicalProcedure`**: Operating room, anesthesia records, and surgical findings.

> 🎙️ **Presenter Notes:**  
> "Using Mongoose discriminators, all clinical orders (Lab, Imaging, Nursing, Consult, Dietary, Procedures) share a single MongoDB collection while maintaining strict polymorphic schemas."

---

## Slide 9: Prescriptions & Clinical Decision Support (CDS)

### Real-Time Medication Safety Checks

* **RxNorm Drug Formulary:** Prescriptions use standardized clinical drug codes, dosages, routes, and frequencies.
* **Real-Time CDS Rules Engine:**
  - **Drug-Drug Interactions:** Checks new orders against active medications (e.g. Warfarin + NSAIDs).
  - **Drug-Allergy Contraindications:** Cross-checks active drug ingredients against patient allergy records.
  - **Duplicate Therapy:** Warns if patient is already taking another drug from the same therapeutic class.
* **Documented Clinical Overrides:** Contraindicated prescriptions require documented physician rationale before submission.
* **Pharmacy Worklist:** Pharmacists verify, check interactions, and dispense medications.

> 🎙️ **Presenter Notes:**  
> "The prescribing engine uses RxNorm drug codes and runs automated Clinical Decision Support (CDS) checks for drug-drug interactions, patient allergies, and duplicate therapies in real time."

---

## Slide 10: Real-Time Hospital Dispatch & SLA Tracking

### Finite State Machine & Porter Task Coordination

$$\text{PENDING} \longrightarrow \text{ASSIGNED} \longrightarrow \text{IN\_TRANSIT} \longrightarrow \text{ARRIVED} \longrightarrow \text{COMPLETED}$$

* **Physical QR Verification:** Porters scan patient wristbands and specimen labels to confirm chain of custody.
* **Socket.IO Real-Time Rooms:** Department Kanban boards (Lab, Radiology, ER) receive instantaneous task updates without polling.
* **Background SLA Sweeper:** Runs every 60 seconds. Tasks exceeding target response windows (e.g. STAT blood draw > 20 mins) trigger `sla:breached` WebSocket events with audio-visual alerts.

> 🎙️ **Presenter Notes:**  
> "Hospital dispatch coordinates specimen and patient transport via a Finite State Machine and physical QR codes. A background SLA sweeper checks every 60 seconds for overdue tasks."

---

## Slide 11: Appointments, Scheduling & Itemized Invoicing

### Conflict-Free Booking & Automated Billing

* **Double-Booking Prevention:** Compound unique indexes on `(providerId, facilityId, startTime)` in MongoDB prevent overlapping doctor appointments.
* **Appointment Lifecycle:** `SCHEDULED` ➔ `CHECKED_IN` ➔ `IN_CONSULTATION` ➔ `COMPLETED`.
* **Automated Consolidated Invoicing:** Aggregates doctor consultation fees, daily room charges (IPD), lab tests, imaging exams, and dispensed pharmacy medications into an itemized bill.
* **Payment Recording:** Captures Cash, Credit Card, and Insurance copayments with PDF receipts.

> 🎙️ **Presenter Notes:**  
> "Appointments use compound unique indexes in MongoDB to prevent double-booking. The billing engine automatically aggregates doctor fees, bed charges, labs, and drugs into an itemized bill."

---

## Slide 12: Tamper-Evident SHA-256 Hash-Chained Audit Trail

### Cryptographic Non-Repudiation for HIPAA § 164.312(b)

$$\text{EntryHash}_n = \text{SHA-256}\Big(\text{EntryHash}_{n-1} \,\|\, \text{Timestamp} \,\|\, \text{ActorID} \,\|\, \text{Action} \,\|\, \text{ResourceID} \,\|\, \text{FacilityID} \,\|\, \text{MetadataDigest}\Big)$$

* **Blockchain-Style Chaining:** If any historical log entry in MongoDB is modified or deleted, the downstream cryptographic chain breaks immediately.
* **Built-In Verification API:** `GET /api/v1/audit/verify` iterates chronologically through the entire audit collection, recalculating hashes to confirm 100% ledger integrity or pinpoint the exact corrupted record.

> 🎙️ **Presenter Notes:**  
> "Audit logs are cryptographically hash-chained with SHA-256. If a record in MongoDB is altered or deleted, the chain breaks downstream. The built-in verify endpoint validates the entire ledger."

---

## Slide 13: HL7 FHIR Release 4 Read Facade

### Standardized Healthcare Interoperability (`/fhir/r4/*`)

Exposes RESTful endpoints conforming to the international HL7 FHIR Release 4 standard:
* `GET /fhir/r4/Patient`: Demographics and medical record numbers.
* `GET /fhir/r4/Encounter`: Outpatient, inpatient, and emergency visits.
* `GET /fhir/r4/Observation`: Vital signs and LOINC-coded laboratory panels.
* `GET /fhir/r4/Condition`: Problem lists mapped to ICD-10-CM codes.
* `GET /fhir/r4/MedicationRequest`: Active prescriptions with RxNorm codes.

Automatically maps encrypted internal MongoDB documents to standard FHIR JSON `searchset` bundles.

> 🎙️ **Presenter Notes:**  
> "The system exposes standard HL7 FHIR Release 4 read endpoints (/fhir/r4/*) for Patient, Encounter, Observation, Condition, and MedicationRequest, translating internal models on the fly."

---

## Slide 14: Frontend Architecture & Material Design 3 UI

### Clinician-Focused Usability & Ergonomics

* **Google Material Design 3 (M3):** Complete M3 tonal palette, elevation containers (0–5), state layers, and typography scales.
* **Persistent Patient Banner:** Always displays MRN, Age/Sex, Blood Group, Active Allergies (high-visibility red badges), and DNR status so clinicians never lose context during chart review.
* **State Management:**
  - Zustand for authentication session persistence and active patient context.
  - TanStack React Query for background server-state caching and auto-revalidation.

> 🎙️ **Presenter Notes:**  
> "The web app is built with Google Material Design 3 design tokens. It includes a persistent Patient Banner showing vital allergies and DNR status so clinicians never lose context."

---

## Slide 15: Automated Testing Rigor

### 69 / 69 Tests Passing with Zero External Dependencies

```
✓ foundation.test.ts               (8 tests)  - AES-GCM, Blind Index, Health Probes
✓ auth_rbac_audit.test.ts          (9 tests)  - Argon2id, TOTP, RBAC Matrix, Hash Chain
✓ patients_search.test.ts          (7 tests)  - MRN Counter, Blind Index Search, Merge
✓ clinical_chart.test.ts           (3 tests)  - Encounters, Signed SOAP, Vitals
✓ procedures_prescriptions.test.ts (11 tests) - Discriminators, PIN Signature, CDS
✓ dispatch_worklists.test.ts       (8 tests)  - Dispatch FSM, SLA Sweeper, Sockets
✓ scheduling_billing_fhir.test.ts  (12 tests) - Double-Booking, Invoicing, FHIR R4
✓ authStore.test.ts                (7 tests)  - Zustand Auth & Permissions
✓ StatusChip.test.tsx              (4 tests)  - M3 Component Rendering

Test Files: 9 passed (9) | Tests: 69 passed (69) | Compilation Errors: 0
```

* **In-Memory Replica Set:** Integration tests use `mongodb-memory-server` to test transactions, atomic counters, and discriminators without needing external database services running.

> 🎙️ **Presenter Notes:**  
> "We have 69 automated tests running against an in-memory MongoDB replica set with 100% pass rate. This allows full testing of transactions and counters with zero external setup."

---

## Slide 16: Quick Start Guide & Demo Logins

### Local Execution & Seeded Clinical Fixtures

```bash
# 1. Start MongoDB Replica Set & Redis
docker compose up -d mongo redis

# 2. Seed 300 realistic patient records
npm run seed

# 3. Launch Development Servers (API :5000, Web :3000)
npm run dev

# 4. Run Automated Test Suite
npm test
```

### Pre-Configured Demo Logins (Password: `Password@123!`)
* **Super Admin:** `admin@ehrtest.local`
* **Physician:** `dr.chen@ehrtest.local`
* **Nurse:** `nurse.patel@ehrtest.local`
* **Pharmacist:** `pharm.rodriguez@ehrtest.local`
* **Radiologist:** `dr.stone@ehrtest.local`
* **Lab Tech:** `tech.davis@ehrtest.local`
* **Receptionist:** `reception.taylor@ehrtest.local`
* **Billing Officer:** `billing.martinez@ehrtest.local`
* **Compliance Auditor:** `auditor.kim@ehrtest.local`

> 🎙️ **Presenter Notes:**  
> "To run locally: start Mongo/Redis with Docker Compose, run npm run seed to generate 300 realistic patients with full clinical histories, and run npm run dev to launch API and Web."

---

## Slide 17: Summary of Key Deliverables

### Technical Strengths
1. **Production-Grade Architecture:** 100% TypeScript monorepo with clean separation between shared schemas, backend services, and web client.
2. **Security & Compliance:** AES-256-GCM field encryption, HMAC blind indexes, Argon2id, TOTP MFA, rotating token families, and tamper-evident SHA-256 audit chaining.
3. **Clinical Workflows:** Signed SOAP notes, vitals outlier alerting, CDS interaction checking, real-time dispatch Kanban, automated invoicing, and HL7 FHIR R4 interoperability.
4. **Verified Quality:** 69 passing automated tests and zero TypeScript build errors.

> 🎙️ **Presenter Notes:**  
> "In summary, the project is a production-ready monorepo with 69 passing tests, field-level encryption, hash-chained auditing, real-time dispatch, and full clinical workflow support."
