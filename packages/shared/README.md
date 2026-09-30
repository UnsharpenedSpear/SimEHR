# @ehr/shared — Domain Contracts, Schemas & Constants

`@ehr/shared` is the core domain contract package for the Simulated EHR platform. It contains TypeScript interfaces, Zod runtime validation schemas, permission definitions, clinical codes, and status enums shared between the backend (`@ehr/api`) and frontend (`@ehr/web`).

---

## 1. Package Structure

```
packages/shared/
├── src/
│   ├── constants/
│   │   ├── permissions.ts    # 9 System Roles, 37 Permissions & Role Mappings
│   │   ├── status.ts         # Encounter, Dispatch, Order, Invoice, Appointment FSM statuses
│   │   └── codes.ts          # ICD-10, RxNorm, CPT, LOINC, SNOMED-CT taxonomies
│   ├── schemas/
│   │   ├── auth.schema.ts        # Login, MFA, Token schemas
│   │   ├── patient.schema.ts     # Registration, Demographics, Search, Merge schemas
│   │   ├── clinical.schema.ts    # Encounters, SOAP Notes, Vitals, Allergies, Problems
│   │   ├── procedure.schema.ts   # Minor, Surgical, Diagnostic procedure schemas
│   │   ├── order.schema.ts       # Lab, Imaging, Nursing, Consult, Dietary schemas
│   │   ├── dispatch.schema.ts    # Dispatch tasks, SLA, QR schemas
│   │   ├── appointment.schema.ts # Scheduling, Time slot schemas
│   │   ├── billing.schema.ts     # Invoices, Payments, Fee schedules
│   │   ├── savedSearch.schema.ts # Saved clinical queries schemas
│   │   └── audit.schema.ts       # Audit events, Hash-chain verification schemas
│   └── index.ts              # Unified entry point & type exports
├── package.json
└── tsconfig.json
```

---

## 2. Key Modules & Exports

### 2.1 Permissions & System Roles (`constants/permissions.ts`)
* `SYSTEM_ROLES`: `SUPER_ADMIN`, `PHYSICIAN`, `NURSE`, `RECEPTIONIST`, `LAB_TECH`, `RADIOLOGIST`, `PHARMACIST`, `BILLING_OFFICER`, `COMPLIANCE_AUDITOR`.
* `PERMISSIONS`: 37 fine-grained actions categorized under Users, Patients, Encounters, Notes, Vitals, Procedures, Orders, Prescriptions, Dispatch, Billing, and Audit.
* `DEFAULT_ROLE_PERMISSIONS`: Pre-configured permission matrices mapped to each standard system role.

### 2.2 Clinical Taxonomies & Ontologies (`constants/codes.ts`)
* **ICD-10-CM:** Common diagnostic categories (Hypertension, Diabetes, Asthma, CAD, Pneumonia, etc.).
* **RxNorm:** Semantic clinical drugs with NDC codes, dosage strengths, and routes.
* **LOINC:** Laboratory observation codes and standard reference intervals.
* **CPT / Procedure Codes:** Ambulatory and inpatient surgical billing codes.

### 2.3 Status Enums & State Machine Constants (`constants/status.ts`)
* `ENCOUNTER_STATUS`: `ARRIVED`, `TRIAGED`, `IN_PROGRESS`, `DISCHARGED`, `CANCELLED`.
* `DISPATCH_STATUS`: `PENDING`, `ASSIGNED`, `IN_TRANSIT`, `ARRIVED`, `COMPLETED`, `CANCELLED`.
* `ORDER_STATUS`: `DRAFT`, `SUBMITTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
* `INVOICE_STATUS`: `DRAFT`, `ISSUED`, `PAID`, `VOID`, `OVERDUE`.

### 2.4 Zod Validation Schemas (`schemas/*`)
All incoming API payloads and frontend forms are strongly validated at runtime using Zod schemas, generating TypeScript static types using `z.infer<typeof Schema>`.

---

## 3. Scripts

* `npm run build`: Compiles TypeScript declarations (`.d.ts`) and JavaScript files into `dist/`.
* `npm run clean`: Removes build output and dependencies.
