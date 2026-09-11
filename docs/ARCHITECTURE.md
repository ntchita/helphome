# Helphome Technical Architecture
Updated: 11 September 2026 (post pilot-refactor)

## System Overview
Helphome is a hybrid NDIS support platform. The pilot runs on a single Hono API that owns
all data; the frontend is a thin client that only fetches and displays it.

React (Cloudflare Pages)
   │  fetch('/api/...')  (Vite dev proxy → localhost:8787)
   ▼
Hono API — src/api/index.ts
   │  local: server.js (@hono/node-server, port 8787)
   │  prod:  Cloudflare Workers (helphome-api)
   ▼
In-memory pilot stores (single source of truth)
   └─ post-pilot: real database (Azure PostgreSQL or Cloudflare D1 — stakeholder decision pending)

## Components

### 1. Frontend (React 18 + Vite + TypeScript, src/frontend)
- Hosted on Cloudflare Pages (helphome-app)
- Role-based routing: client, worker, manager, admin (App.tsx; BUILD_ID invalidates old sessions)
- Every page fetches its data from the API; zero hardcoded data, zero client-side data stores
- No mock layer (src/services/api.ts and src/types removed 11/09/2026)

### 2. Backend (Hono, src/api/index.ts)
- Single source of truth for ALL pilot data: workers, bookings/requests, check-ins,
  roster, verification queue, admin KPIs/charts/alerts, demo auth
- Matching logic: src/api/utils/matcher.ts (calculateWellnessMatch, rankWorkers)
- Served locally by server.js via @hono/node-server (port 8787)
- Deployed as Cloudflare Workers project helphome-api
- Runtime-agnostic: identical code runs on Workers, Node/Bun/Deno, and Azure
  (App Service / Functions / Container Apps) via @hono/node-server

### 3. Database
- Pilot: in-memory arrays inside the API (resets on restart / isolate recycle) — intentional
- Post-pilot: real DB queries replace the arrays inside src/api/index.ts;
  no frontend page changes required
- Reference implementations kept for that migration:
  src/server/index.ts (Drizzle + D1 + JWT prototype), src/db/schema.ts, docs/database-schema.sql

### 4. External integrations (all post-pilot)
- Payments: Stripe / Xero sync
- Documents: Cloudflare R2
- Notifications: email (Resend or SendGrid)

## Authentication (current pilot state)
- Demo accounts served by the API: GET /api/demo-accounts, POST /api/login
- Session = localStorage (helphome_logged_in, helphome_role), cleared when BUILD_ID changes
- Post-pilot: real users table, bcrypt password hashing, JWT or session cookies

## API surface (current)
- Workers & matching: GET /api/workers, /api/interests, /api/client-profile
- Bookings: GET+POST /api/bookings, GET /api/requests
- Worker hub: GET /api/worker-hub, GET+POST /api/checkins, POST /api/worker-hub/decision
- Manager: GET /api/roster, POST /api/roster/:id/welfare-chat
- Admin: GET /api/admin/kpis|alerts|activity|people|health, POST /api/admin/alerts/:id/dismiss
- Charts: GET /api/charts/trend|status|revenue
- Verification: GET /api/verification, POST /api/verification/:id/toggle,
  GET /api/verification/activity|stats
- Auth & intake: GET /api/demo-accounts, POST /api/login, POST /api/auth/register, POST /api/wellness

## Deployment
- Frontend: wrangler pages deploy → helphome-app.pages.dev
- API: wrangler deploy → helphome-api.lifewealth.workers.dev
- Rule during pilot: production frozen; all work happens in dev until the stakeholder meeting
- Source: github.com/ntchita/helphome (branch main)

## Post-pilot roadmap
1. Replace in-memory stores with real DB queries inside src/api/index.ts
2. Real authentication (users table, hashing, JWT) + manager/coordinator invites
3. Payments, document uploads (R2), session logs, reviews (see USER_STORIES.md)
4. Infrastructure per stakeholder decision (Azure fully supported via node adapter)