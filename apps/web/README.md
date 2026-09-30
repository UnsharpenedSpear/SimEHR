# @ehr/web — Material Design 3 Clinical Frontend

`@ehr/web` is the modern, responsive web application for the Simulated EHR platform. It is built using **React 18/19**, **TypeScript 5.7**, **Vite 6**, and **Google Material Design 3 (M3)** design principles.

---

## 1. Directory Structure

```
apps/web/
├── src/
│   ├── app/
│   │   └── App.tsx               # Root component, React Router v6, QueryClientProvider
│   ├── components/
│   │   ├── common/
│   │   │   ├── StatusChip.tsx    # M3 tonal status badges & indicators
│   │   │   ├── StatusChip.test.tsx
│   │   │   └── LoadingOverlay.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx      # Main layout, App Bar, Facility Switcher, User Menu
│   │       ├── NavRail.tsx       # M3 responsive navigation rail
│   │       └── PatientBanner.tsx # Persistent patient clinical header
│   ├── features/                 # Clinical & Administrative Views
│   │   ├── admin/                # User management, role editor, facility config
│   │   ├── appointments/         # Scheduling calendar, slot booking & check-in
│   │   ├── audit/                # Tamper-evident audit trail & verification UI
│   │   ├── auth/                 # Login, MFA verification & session recovery
│   │   ├── billing/              # Invoice generator, payment processing & receipts
│   │   ├── chart/                # Longitudinal chart, SOAP notes, vitals graphs, orders, CDS
│   │   ├── dashboard/            # Role-specific clinical dashboards & worklists
│   │   ├── dispatch/             # Real-time Dispatch Kanban board & SLA alerts
│   │   ├── patients/             # Patient registration, search, merge & duplicate detector
│   │   └── reports/              # Executive KPI analytics & clinical census charts
│   ├── services/
│   │   ├── apiClient.ts          # Axios instance with interceptors, token refresh & facility headers
│   │   └── socketClient.ts       # Socket.IO client instance for real-time channels
│   ├── stores/
│   │   ├── authStore.ts          # Zustand store for auth state, tokens & permissions
│   │   ├── authStore.test.ts     # Vitest tests for auth state mutations
│   │   └── uiStore.ts            # Zustand store for active patient, theme & modals
│   ├── theme/
│   │   ├── m3Tokens.ts           # Google Material Design 3 HSL design tokens
│   │   └── theme.ts              # MUI theme generator supporting light & dark modes
│   └── main.tsx                  # Application bootstrap
├── Dockerfile
├── nginx.conf                    # Production Nginx reverse proxy configuration
├── package.json
├── tsconfig.json
└── vite.config.ts                # Vite config with path aliases & chunk optimization
```

---

## 2. Design System: Google Material Design 3 (M3)

* **Design Tokens (`theme/m3Tokens.ts`):** Complete M3 tonal palette including Primary, Secondary, Tertiary, Neutral, Error, and Container variants for both Light and Dark modes.
* **Component Elevation & State Layers:** Surface elevations 0–5, hover/pressed state layers, and rounded corner scales (extra-small to extra-large).
* **Typography Hierarchy:** Clean Google Font integration (Inter/Roboto) with Display, Headline, Title, Body, and Label scales.

---

## 3. State Management & API Integration

* **`authStore` (Zustand):**
  - Manages active JWT access token, user profile, role, and permission matrix.
  - Automatically handles session persistence via SSR-safe storage adapter.
  - Handles Break-Glass emergency mode session tracking.
* **`apiClient` (Axios):**
  - Automatically attaches `Authorization: Bearer <token>` and `X-Facility-Id` headers.
  - Intercepts `401 Unauthorized` responses to seamlessly refresh tokens via `POST /api/v1/auth/refresh`.
  - Injects `X-Idempotency-Key` for critical mutations.
* **`TanStack React Query`:**
  - Manages server-side caching, optimistic UI updates, and real-time cache invalidation on WebSocket events.

---

## 4. Scripts

* `npm run dev`: Starts Vite development server on `http://localhost:3000` with API proxying to port `5000`.
* `npm run build`: Type-checks with `tsc` and compiles production bundle with optimized vendor chunking into `dist/`.
* `npm run preview`: Locally previews the production build.
* `npm test`: Runs frontend Vitest component and store test suites.
