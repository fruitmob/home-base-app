# Home Base — Deployment Runbook

This is the playbook for standing up a **new single-tenant Home Base deployment** from a clean state. Follow it end to end. The platform ships one deployment per shop — never share a Supabase project or Vercel project between customers.

Estimated time: about an hour of human attention, plus waiting on migrations and DNS propagation.

---

## 0. Prerequisites

- Access to the `fruitmob/home-base-app` GitHub repo.
- A credit-capable account for Supabase, Vercel, Stripe, Resend, and AWS (S3).
- `npm`, `git`, and a modern Node (v20+) locally.
- The [scripts/seed-demo.ts](scripts/seed-demo.ts) and [scripts/deploy-smoke.ts](scripts/deploy-smoke.ts) utilities live in this repo and are referenced below.

---

## 1. Provision a fresh Supabase project

1. In the [Supabase dashboard](https://supabase.com/dashboard) click **New project**.
2. Name it after the customer — e.g. `cedar-ridge-prod`. Keep it separate from any existing Home Base dev/staging project.
3. Pick a region close to the customer's fleet operations.
4. Record the generated database password in the customer's password manager. Home Base never stores the Supabase password in the repo.
5. Once the project is ready, grab two connection strings from **Project Settings → Database**:
   - **Pooled (Supavisor, port 6543, transaction mode)** — this is `POSTGRES_PRISMA_URL`.
   - **Session mode (pooler host, port 5432)** — this is `POSTGRES_URL_NON_POOLING`. Do not use the legacy `db.<ref>.supabase.co` host; it is IPv6-only.
6. Grab the publishable REST/Realtime key from **Project Settings → API** for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## 2. Provision a fresh Vercel project

1. In the [Vercel dashboard](https://vercel.com/dashboard) click **Add New → Project**.
2. Import the `fruitmob/home-base-app` repository. Choose the production branch you plan to deploy from (usually `main`).
3. Under **Environment Variables**, populate everything from the matrix in section 4 below. Do not commit any of these values to the repo.
4. Leave the build command at the default (`npm run build`) and the output directory blank — Next.js handles both.
5. Click **Deploy**. The first build will fail the health check because the database is empty — that is expected; we migrate next.

## 3. Run migrations against the new Supabase

Pull the repo locally and point at the new Supabase temporarily:

```bash
git clone https://github.com/fruitmob/home-base-app.git
cd home-base-app
cp .env.example .env   # or create .env from scratch
# fill in POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, DATABASE_URL
npm install
npx prisma migrate deploy
```

`prisma migrate deploy` only applies already-committed SQL migrations in `prisma/migrations/` — it never authors new ones. Safe to run against production.

## 4. Env var matrix

Fill these in on the Vercel project's **Production** environment. Re-deploy after any change so the new values take effect.

| Variable | Purpose | Where it comes from |
|---|---|---|
| `POSTGRES_PRISMA_URL` | Runtime pooled connection | Supabase → Database → Pooled (6543) |
| `POSTGRES_URL_NON_POOLING` | Migration/direct connection | Supabase → Database → Session (5432) |
| `DATABASE_URL` | Alias used by some tooling | Same value as `POSTGRES_PRISMA_URL` |
| `NEXT_PUBLIC_SUPABASE_URL` | Front-end REST/Realtime base | Supabase → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Front-end publishable key | Supabase → API |
| `SESSION_SECRET` | Cookie-session encryption key | `openssl rand -hex 32` — unique per deployment |
| `RESEND_API_KEY` | Transactional email | Resend dashboard |
| `EMAIL_FROM` | Transactional from address | e.g. `Cedar Ridge Service <noreply@cedarridge.email>` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | Stripe → Developers → Webhooks → Signing secret |
| `STRIPE_CHECKOUT_URL` | Self-service upgrade link | Stripe → Payment Links |
| `STRIPE_CUSTOMER_PORTAL_URL` | Self-service billing portal link | Stripe → Customer Portal |
| `CRON_SECRET` | Cron-invocation shared secret | `openssl rand -hex 32` — unique per deployment. Vercel Cron sends it as `Authorization: Bearer ${CRON_SECRET}`. |
| `AWS_REGION` | S3 region | Your AWS choice |
| `AWS_ACCESS_KEY_ID` | S3 uploads | AWS IAM — scoped to this deployment's bucket only |
| `AWS_SECRET_ACCESS_KEY` | S3 uploads | AWS IAM |
| `S3_BUCKET` | Upload bucket | AWS S3 — unique per deployment |

**Generate a new `SESSION_SECRET` per deployment.** Never reuse one across customers. On a Mac/Linux shell: `openssl rand -hex 32`.

## 5. Seed the demo tenant

Only run this step if the customer wants demo data preloaded (most do for their first walkthrough). You can re-seed at any time — the script is idempotent.

```bash
SEED_DEMO_PASSWORD="<something-you-are-ok-sharing-with-demo-reviewers>" npm run seed:demo
```

This runs [scripts/seed-demo.ts](scripts/seed-demo.ts) and creates the "Cedar Ridge Service" demo dataset: 6 staff users, 3 customers, 6 vehicles, ~40 parts, 12 work orders across every status, 1 in-flight estimate, 1 ready-to-bill work order with an approved change order, 1 closed work order, 1 KB article, 1 training assignment, and 1 Lens video record.

Default email addresses are `owner@cedarridge.demo`, `manager@cedarridge.demo`, etc. Default password is `cedar-ridge-demo` if `SEED_DEMO_PASSWORD` is unset — override it for any shared or semi-public environment.

## 6. Wire Stripe

1. In [Stripe](https://dashboard.stripe.com), create a subscription product with the pricing you want to charge this customer.
2. Create a **Payment Link** for it and copy the URL into `STRIPE_CHECKOUT_URL`.
3. Enable the **Customer Portal** under Settings → Billing → Customer Portal. Copy the customer-portal URL into `STRIPE_CUSTOMER_PORTAL_URL`.
4. Add a new webhook endpoint pointed at `https://<your-domain>/api/webhooks/stripe`. Subscribe to the full `customer.subscription.*` event family plus `invoice.payment_failed` and `invoice.payment_succeeded`.
5. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. The Home Base webhook endpoint returns 503 if that secret is absent, so it will refuse to process events until it is configured.

Stripe events populate the `Subscription` and `BillingEvent` tables; owner users see live status at `/admin/billing`.

## 7. Generate the first API key (optional but recommended)

If any integration will read from the public API (e.g. a customer's ERP), issue a scoped API key:

1. Log in as an OWNER or ADMIN user.
2. Visit `/admin/api-keys`.
3. Click **Issue key**, pick the scopes, copy the plaintext key — it is shown exactly once.
4. Hand the plaintext key to the integration owner through a secure channel. Home Base only stores the hash.

## 8. Run the post-deploy smoke harness

Before cutting over DNS, validate the deployment end to end:

```bash
HOMEBASE_BASE_URL="https://<vercel-default-domain>" \
HOMEBASE_API_KEY="hbk_..." \
npx tsx scripts/deploy-smoke.ts
```

The harness hits `/api/health` and all four public read endpoints and prints a pass/fail per check. Exit code is non-zero on any failure. It is read-only — safe to run against prod.

If `/api/health` fails, check Supabase status and the `DATABASE_URL` env value. If the public endpoints fail with 401/403, confirm the API key's scopes.

## 9. Role walkthrough (manual)

Spot-check each major role logs in and sees a populated dashboard:

- `owner@cedarridge.demo` → Leadership dashboard + Admin nav item visible
- `manager@cedarridge.demo` → Service manager dashboard
- `writer@cedarridge.demo` → Service writer desk with their work orders
- `tech@cedarridge.demo` → Technician queue + active timers
- `parts@cedarridge.demo` → Parts dashboard with low-stock watchlist
- `sales@cedarridge.demo` → Sales pipeline + goal progress

If anything looks empty, re-run the demo seed (it is idempotent).

## 10. Cut over DNS

1. In Vercel, go to **Settings → Domains** on the project and add the customer's domain.
2. Point the customer's DNS at the Vercel CNAME target per their DNS provider.
3. Wait for the SSL certificate to provision (usually under a minute).
4. Re-run `scripts/deploy-smoke.ts` against the new domain.
5. Send the customer their URL and demo credentials.

## 11. Verify Vercel Cron is firing

[vercel.json](vercel.json) schedules `/api/cron/process-webhooks` every five minutes. Vercel automatically sends the `CRON_SECRET` you configured as `Authorization: Bearer …` on each scheduled call; the endpoint 401s anything else.

After the first deploy:

1. Open **Vercel → Project → Settings → Cron Jobs** and confirm the schedule is registered.
2. Wait five minutes, then open **Vercel → Project → Deployments → Functions → Cron logs** and verify a 200 response body of `{ processed: ..., succeeded: ..., pending: ..., permanentlyFailed: ... }`.
3. If the cron shows 401s, re-check that `CRON_SECRET` is set to the same value in the cron config and in the project env.

Without this cron, outbound webhook retries only fire when an owner clicks "Run delivery queue" on `/admin/webhooks`. The queue itself is correct either way.

## 12. Turn on uptime monitoring

`/api/health` returns `{ ok: true, db: <ms> }` on success and 503 on database failure. Point any uptime monitor (BetterUptime, Uptime Kuma, Pingdom, etc.) at that URL with a 60-second interval.

---

## Recovery and data loss

If the database is ever lost or corrupted, follow [RECOVERY.md](RECOVERY.md). Supabase Point-in-Time Recovery (PITR) is our primary restore path.

## Where to find help

- [README.md](README.md) gives the product and repo overview.
- Domain code is grouped under [lib/](lib/) by surface area: auth, shop, sales, reports, email, webhooks, billing, admin, and Gauge.
- Smoke tests in [tests/](tests/) are the best executable map of expected behavior.
