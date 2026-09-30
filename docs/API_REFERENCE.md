# API Reference & Protocol Specification

The **Simulated EHR** API is a RESTful and HL7 FHIR R4 compliant service built on Express and TypeScript. It features RFC 7807 problem details, strict schema validation via Zod, JWT/MFA authentication, role-based authorization, rate limiting, and real-time WebSocket events.

* **Base REST URL:** `http://localhost:5000/api/v1`
* **Base FHIR URL:** `http://localhost:5000/fhir/r4`
* **WebSocket Endpoint:** `ws://localhost:5000` (Socket.IO)

---

## 1. Request & Response Conventions

### 1.1 Mandatory & Optional Headers

| Header | Type | Description |
| :--- | :--- | :--- |
| `Authorization` | `string` | Format: `Bearer <jwt-access-token>`. Required for protected routes. |
| `X-Facility-Id` | `string` | Active facility identifier (e.g., `FAC-MAIN`, `FAC-NORTH`). Scopes tenant data. |
| `X-Idempotency-Key` | `string` | UUIDv4 string. Guarantees mutation idempotency on orders, billing, and dispatch. |
| `X-Break-Glass-Reason`| `string` | Clinical justification required when invoking emergency access. |
| `Content-Type` | `string` | Must be `application/json` (or `application/fhir+json` for FHIR). |

### 1.2 RFC 7807 Problem Details (Error Response)

All error responses adhere to RFC 7807:

```json
{
  "type": "https://ehr.example.com/errors/validation-error",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Patient with SSN already exists in facility FAC-MAIN",
  "instance": "/api/v1/patients",
  "code": "DUPLICATE_ENTITY",
  "invalidParams": [
    {
      "name": "ssn",
      "reason": "SSN blind index collision detected"
    }
  ],
  "timestamp": "2026-09-30T09:45:00.000Z"
}
```

---

## 2. Authentication & Identity Endpoints (`/auth`)

### `POST /api/v1/auth/login`
Authenticates user with email and password. Returns access token, or requires TOTP MFA if enabled.

**Request Body:**
```json
{
  "email": "dr.chen@ehrtest.local",
  "password": "Password@123!",
  "facilityId": "FAC-MAIN"
}
```

**Response (200 OK — MFA Not Required):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "refreshToken": "d7a4b89e-...",
  "user": {
    "id": "673f8a9b0c1d2e3f4a5b6c7d",
    "name": "Dr. Emily Chen",
    "email": "dr.chen@ehrtest.local",
    "role": "PHYSICIAN",
    "facilityId": "FAC-MAIN",
    "permissions": ["patient:read", "note:write", "order:create", "prescription:prescribe"]
  }
}
```

### `POST /api/v1/auth/mfa/verify`
Completes MFA challenge with a 6-digit TOTP code.

**Request Body:**
```json
{
  "tempToken": "temp-session-token",
  "code": "582910"
}
```

### `POST /api/v1/auth/refresh`
Rotates the refresh token and issues a new short-lived access token.

**Request Body:**
```json
{
  "refreshToken": "d7a4b89e-..."
}
```

### `POST /api/v1/auth/logout`
Revokes the refresh token family and terminates active sessions.

---

## 3. Patient Master Index & Demographics (`/patients`)

### `POST /api/v1/patients`
Registers a new patient with automatic blind indexing and atomic MRN generation.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1980-05-14",
  "gender": "male",
  "ssn": "000-12-3456",
  "email": "john.doe@example.com",
  "phone": "+1-555-0199",
  "bloodGroup": "O_POS",
  "address": {
    "street": "123 Medical Way",
    "city": "Boston",
    "state": "MA",
    "zipCode": "02115"
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "+1-555-0198"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "6740a1b2c3d4e5f6a7b8c9d0",
  "mrn": "MRN-MAIN-202609-00042",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1980-05-14T00:00:00.000Z",
  "gender": "male",
  "bloodGroup": "O_POS",
  "createdAt": "2026-09-30T09:40:00.000Z"
}
```

### `POST /api/v1/patients/search`
Searches patients by exact blind index (SSN/Phone/Email) or fuzzy demographic criteria.

**Request Body:**
```json
{
  "query": "John Doe",
  "ssn": "000-12-3456",
  "dob": "1980-05-14",
  "facilityId": "FAC-MAIN"
}
```

### `POST /api/v1/patients/duplicate-check`
Calculates probabilistic similarity score (0.00 – 1.00) against existing patient records.

### `POST /api/v1/patients/merge`
Consolidates two patient records (source into target), updating all encounter and chart lineages.

---

## 4. Encounters & Clinical Documentation

### `POST /api/v1/encounters`
Initiates an outpatient (OPD), inpatient (IPD), emergency (ER), or telehealth encounter.

**Request Body:**
```json
{
  "patientId": "6740a1b2c3d4e5f6a7b8c9d0",
  "providerId": "673f8a9b0c1d2e3f4a5b6c7d",
  "type": "OUTPATIENT",
  "department": "CARDIOLOGY",
  "reasonForVisit": "Persistent chest tightness and shortness of breath"
}
```

### `POST /api/v1/clinical-notes`
Authors a Subjective, Objective, Assessment, Plan (SOAP) clinical note.

**Request Body:**
```json
{
  "encounterId": "6741b2c3d4e5f6a7b8c9d0e1",
  "patientId": "6740a1b2c3d4e5f6a7b8c9d0",
  "subjective": "Patient reports 3-day history of exertional dyspnea.",
  "objective": "BP 142/88, HR 82, SpO2 97% on room air. Lungs clear to auscultation.",
  "assessment": "Essential hypertension with exertional fatigue.",
  "plan": "Start Lisinopril 10mg PO daily. Order baseline ECG and CMP."
}
```

### `POST /api/v1/clinical-notes/:id/sign`
Digitally signs and seals the clinical note, making it immutable.

### `POST /api/v1/clinical-notes/:id/amend`
Appends a signed amendment/addendum to a previously signed note.

---

## 5. Vitals, Problems & Allergies

### `POST /api/v1/vitals`
Records patient vitals, calculates BMI, and flags outlier vitals.

**Request Body:**
```json
{
  "patientId": "6740a1b2c3d4e5f6a7b8c9d0",
  "encounterId": "6741b2c3d4e5f6a7b8c9d0e1",
  "bloodPressureSystolic": 142,
  "bloodPressureDiastolic": 88,
  "heartRate": 82,
  "respiratoryRate": 16,
  "temperature": 98.6,
  "oxygenSaturation": 97,
  "heightCm": 178,
  "weightKg": 84
}
```

**Response (201 Created):**
```json
{
  "id": "6742c3d4e5f6a7b8c9d0e1f2",
  "bmi": 26.51,
  "bmiClassification": "OVERWEIGHT",
  "isOutlier": false,
  "recordedAt": "2026-09-30T09:41:00.000Z"
}
```

---

## 6. Orders, Procedures & CDS Prescribing

### `POST /api/v1/orders`
Creates a clinical order (Lab, Imaging, Nursing, Consult, Dietary).

**Request Body:**
```json
{
  "patientId": "6740a1b2c3d4e5f6a7b8c9d0",
  "encounterId": "6741b2c3d4e5f6a7b8c9d0e1",
  "orderType": "LAB",
  "priority": "STAT",
  "tests": ["CBC", "CMP", "TROPONIN_I"],
  "clinicalIndication": "Rule out acute coronary syndrome"
}
```

### `POST /api/v1/prescriptions/cds-check`
Runs real-time Clinical Decision Support (CDS) cross-checks for drug-drug interactions, drug-allergy contraindications, and duplicate therapies.

**Request Body:**
```json
{
  "patientId": "6740a1b2c3d4e5f6a7b8c9d0",
  "medication": {
    "rxNormCode": "314076",
    "name": "Lisinopril 10 MG Oral Tablet",
    "dosage": "10mg",
    "frequency": "ONCE_DAILY",
    "route": "ORAL"
  }
}
```

**Response (200 OK):**
```json
{
  "passed": true,
  "warnings": [
    {
      "type": "DRUG_DRUG_MODERATE",
      "severity": "MODERATE",
      "title": "Potential Hyperkalemia Risk",
      "detail": "Patient currently taking Potassium Chloride supplement. Monitor serum potassium."
    }
  ]
}
```

---

## 7. Real-Time Dispatch & Worklists (`/dispatch`, `/diagnostics`)

### `POST /api/v1/dispatch`
Dispatches a transport or clinical specimen task across hospital departments.

**Request Body:**
```json
{
  "patientId": "6740a1b2c3d4e5f6a7b8c9d0",
  "taskType": "SPECIMEN_TRANSPORT",
  "priority": "STAT",
  "originDepartment": "ER",
  "destinationDepartment": "LAB",
  "slaMinutes": 20
}
```

### `PUT /api/v1/dispatch/:id/status`
Updates task status through the Finite State Machine (`ASSIGNED` → `IN_TRANSIT` → `ARRIVED` → `COMPLETED`).

---

## 8. HL7 FHIR R4 Read Facade (`/fhir/r4`)

Supports interoperability with standard FHIR JSON format:

* `GET /fhir/r4/Patient?_id=6740a1b2c3d4e5f6a7b8c9d0`
* `GET /fhir/r4/Encounter?patient=6740a1b2c3d4e5f6a7b8c9d0`
* `GET /fhir/r4/Observation?patient=6740a1b2c3d4e5f6a7b8c9d0&category=vital-signs`
* `GET /fhir/r4/Condition?patient=6740a1b2c3d4e5f6a7b8c9d0`
* `GET /fhir/r4/MedicationRequest?patient=6740a1b2c3d4e5f6a7b8c9d0`

---

## 9. Real-Time WebSocket Events

Client joins department and facility channels on connection:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: accessToken }
});

// Join Department Room
socket.emit('join:room', { room: 'dept:LAB' });

// Listen for Dispatches & SLA Breaches
socket.on('task:created', (task) => console.log('New Task:', task));
socket.on('sla:breached', (alert) => console.warn('SLA Alert:', alert));
socket.on('vital:alert', (outlier) => console.error('Critical Vitals Alert:', outlier));
```
