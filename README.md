# Home Base

A single-tenant vehicle service shop platform. One deployment per shop, with no tenant glue, shared customer data, or multi-tenant compromises in the schema.

The current build includes the full service workflow: sales CRM, work orders, parts, estimates, customer portal, knowledge base, Lens video, Gauge AI, admin tools, reporting, integrations, billing, and deployment runbooks.

---

## What a shop actually does with it

**Front of house (sales + service writing)**
Lead capture, opportunity pipeline, quoting with line-item builder and PDF export, activity timeline, sales goals, and a sales-performance report.

**Shop floor (service ops)**
Work orders with typed line items, technician assignment, bay scheduling, arrival and PDI inspections, QC lane, change orders, and live time tracking with submit, approve, and lock workflows.

**Parts**
Inventory with reorder points, vendor records, part transactions, reservations against work-order lines, and a parts-inventory report for low stock, turn, dead stock, and vendor responsiveness.

**Accounting**
Ready-to-bill queue, approved-estimate and change-order totals MTD, warranty recovery tracking, and a dedicated financial closeout report with CSV and PDF export.

**Customer portal**
Tokenized customer access to work orders, estimates, uploads, and two-way messaging. Portal magic links go through a templated email pipeline.

**Knowledge base + training**
In-app markdown articles with versioning, categories, and per-user training assignments with completion tracking.

**Lens video**
Internal walkaround-video platform tied to work orders and vehicles. Upload, playback, and shareable links.

**Gauge AI assistant**
Local-first AI assistant with a retrieval layer over the full DB, read-only tools, and a confirmed-write flow for mutating actions. Provider-adapter design lets mock, Ollama, or hosted providers swap without touching tool code.

**Admin + reports**
Role-aware home dashboard, reports hub with per-user layout persistence, detailed service, sales, parts, and closeout reports, CSV exports, PDF exports where print is a real workflow, user administration, audit log, data exceptions, feature flags, and owner support impersonation.

**Integrations**
Templated emails with persisted `EmailSend` rows per attempt. Outbound webhooks with HMAC-SHA256 signing, per-endpoint secrets, exponential-backoff retries, and an owner-only configuration UI. Public read API under `/api/public/v1/*` behind hashed, scoped API keys with a 60 requests-per-minute rate limit.

**Billing**
Stripe-driven license state. Webhook signature verification, subscription mirror with out-of-order event handling, and a non-destructive owner-only banner when billing needs attention. Feature access stays intact when a subscription lapses.

**Background jobs**
Vercel Cron fires `/api/cron/process-webhooks` every five minutes to drive the webhook delivery queue and sweep stale rate-limit rows. Authenticated with a shared `CRON_SECRET`.

---

## Stack

Next.js 14 App Router, TypeScript strict, Tailwind CSS, Prisma 7 on PostgreSQL via Supabase pooler, cookie-based sessions, CSRF double-submit, pdf-lib, dnd-kit, Recharts, Resend, Stripe, AWS S3, Vercel, and Vercel Cron.

Auth and CSRF are load-bearing. Read [lib/auth.ts](lib/auth.ts) and [lib/csrf.ts](lib/csrf.ts) before touching anything that talks to sessions.

---

## Getting it running locally

```bash
git clone https://github.com/fruitmob/home-base-app.git
cd home-base-app
npm install
cp .env.example .env       # fill in local Supabase URLs and secrets
npx prisma migrate deploy
npx prisma db seed         # owner + dev demo data
npm run dev                # http://localhost:3000
```

Tests run with `tsx` against a live Postgres:

```bash
npm run test               # smoke suite
npm run seed:demo          # Cedar Ridge Service demo tenant, idempotent
```

---

## Shipping to a customer

Home Base ships one deployment per shop. Provisioning a fresh stack is covered by:

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Supabase project, Vercel project, env matrix, migrations, demo seed, Stripe wiring, API-key issuance, post-deploy smoke, role walkthrough, DNS cutover, cron verification, and uptime monitoring.
- **[RECOVERY.md](RECOVERY.md)** - Supabase PITR restore to a new project, verification on a preview, cutover, and post-incident hygiene.
- **[scripts/seed-demo.ts](scripts/seed-demo.ts)** - Cedar Ridge Service demo tenant. Safe to run twice.
- **[scripts/deploy-smoke.ts](scripts/deploy-smoke.ts)** - read-only post-deploy harness for `/api/health` and all four public read endpoints.

---

## Repo map

- [prisma/schema.prisma](prisma/schema.prisma) - the full schema. [prisma/migrations/](prisma/migrations/) holds reviewed SQL.
- [app/](app/) - Next.js App Router. UI under `app/(app)/`, portal routes under `app/(portal)/`, and API routes under `app/api/`.
- [lib/](lib/) - shared server logic grouped by domain: auth, audit, csrf, core, reports, email, webhooks, API keys, billing, cron, Gauge, shop, sales, and admin.
- [components/](components/) - React components. Client components are marked with `"use client"`.
- [tests/](tests/) - smoke tests. Suites are runnable on their own with `npx tsx tests/<name>-smoke.test.ts`.
- [scripts/](scripts/) - operational utilities.

---

## License

Source-available under the [PolyForm Shield License 1.0.0](LICENSE). You can self-host Home Base for any purpose, including in production. You cannot offer it as a hosted or managed service that competes with the official one.
