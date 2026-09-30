# @ehr/api — Backend REST, WebSocket & FHIR R4 Service

`@ehr/api` is the high-performance backend application powering the Simulated EHR platform. It is built with **Node.js**, **Express**, **TypeScript**, **Mongoose (MongoDB 7.0)**, **Redis 7.0**, and **Socket.IO**.

---

## 1. Directory Structure

```
apps/api/
├── src/
│   ├── config/               # Environment variable validation, Pino logger, DB/Redis clients
│   ├── db/
│   │   ├── indexes.ts        # Database indexing & compound search indexes
│   │   └── queries/          # Complex aggregation pipelines & stored queries
│   ├── jobs/
│   │   └── dispatchSla.sweeper.ts  # Background SLA monitor for dispatch tasks
│   ├── middleware/
│   │   ├── authn.middleware.ts     # JWT Access Token & session validator
│   │   ├── authz.middleware.ts     # RBAC & Facility ABAC guard
│   │   ├── audit.middleware.ts     # SHA-256 hash-chained audit logger
│   │   ├── error.middleware.ts     # RFC 7807 Problem Details handler
│   │   ├── idempotency.middleware.ts # Redis-backed X-Idempotency-Key filter
│   │   ├── rateLimiter.middleware.ts # Sliding window token bucket
│   │   └── validate.middleware.ts  # Zod schema request validator
│   ├── modules/              # Domain-Driven Modules
│   │   ├── admin/            # System configuration & facility provisioning
│   │   ├── allergies/        # Patient allergy records & contraindication flags
│   │   ├── appointments/     # Scheduling & double-booking prevention
│   │   ├── audit/            # Hash-chained audit inspection & verification
│   │   ├── auth/             # Argon2id, TOTP MFA, rotating refresh tokens
│   │   ├── billing/          # Itemized invoicing, payments, fee calculations
│   │   ├── clinical-notes/   # SOAP notes, digital signatures, amendments
│   │   ├── departments/      # Hospital department management & room routing
│   │   ├── diagnostics/      # Lab result entry & radiology imaging worklists
│   │   ├── dispatch/         # Real-time dispatch FSM & porter task tracking
│   │   ├── documents/        # Clinical attachments & file metadata
│   │   ├── encounters/       # OPD, IPD, ER, Telehealth encounters
│   │   ├── fhir/             # HL7 FHIR R4 read facade
│   │   ├── immunizations/    # Vaccine tracking & lot administration
│   │   ├── orders/           # Polymorphic clinical orders (Lab, Imaging, etc.)
│   │   ├── patients/         # Patient master index, AES-256-GCM encryption, blind indexing
│   │   ├── prescriptions/    # RxNorm prescribing & CDS interaction engine
│   │   ├── problems/         # ICD-10 problem list management
│   │   ├── procedures/       # Minor, Surgical & Diagnostic procedure tracking
│   │   ├── reports/          # Executive KPI analytics & census calculations
│   │   ├── roles/            # RBAC role definitions & permission matrices
│   │   ├── saved-searches/   # User saved search filters
│   │   ├── users/            # Clinical staff accounts & profiles
│   │   └── vitals/           # Physiological vitals & BMI calculation
│   ├── realtime/
│   │   └── socket.ts         # Socket.IO department rooms & event dispatchers
│   ├── seed/
│   │   └── seed.ts           # Synthetic clinical database generator (300+ patients)
│   ├── tests/                # Vitest integration test suites
│   ├── utils/
│   │   └── crypto.util.ts    # AES-256-GCM encryption & HMAC-SHA256 blind indexing
│   ├── app.ts                # Express application setup & middleware assembly
│   └── server.ts             # HTTP & Socket.IO server bootstrap
├── Dockerfile
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 2. Key Architecture Components

### 2.1 Middleware Execution Pipeline
Every incoming HTTP request traverses a hardened security pipeline:
1. **Pino HTTP Logger:** Injects correlation IDs and logs structured JSON.
2. **Redis Rate Limiter:** Enforces IP/Token sliding window rate limits.
3. **CORS & Security Headers:** Restricts cross-origin requests.
4. **AuthN Middleware:** Validates JWT access tokens and populates `req.user`.
5. **AuthZ Middleware:** Checks required permissions and verifies `X-Facility-Id`.
6. **Idempotency Filter:** Deduplicates requests bearing `X-Idempotency-Key`.
7. **Zod Validation Middleware:** Validates body, query, and params against domain schemas.
8. **Controller / Service Execution:** Domain business logic and cryptographic transforms.
9. **Audit Middleware:** Computes SHA-256 hash-chained audit record.
10. **RFC 7807 Error Handler:** Catches exceptions and returns standardized Problem Details.

### 2.2 In-Memory Testing Architecture
Integration tests (`npm test`) utilize `mongodb-memory-server` to spin up an ephemeral in-memory MongoDB replica set. This enables full transaction, counter, and discriminator testing without external dependencies.

---

## 3. Scripts

* `npm run dev`: Starts development server with hot-reload via `tsx watch` on port `5000`.
* `npm run build`: Compiles TypeScript to `dist/`.
* `npm start`: Runs compiled production server (`node dist/server.js`).
* `npm test`: Runs Vitest integration test suites.
* `npm run seed`: Runs synthetic clinical data generator.
