# Home Base — Recovery Runbook

This document covers **data-loss recovery** for a live Home Base deployment. It assumes you already have [DEPLOYMENT.md](DEPLOYMENT.md) context — if a deployment has never been stood up, start there instead.

Home Base is single-tenant. Each customer's data lives in its own Supabase Postgres project, so recovery is a per-deployment operation. Supabase Point-in-Time Recovery (PITR) is the primary restore path.

---

## 0. First five minutes: assess, do not destroy

Before touching anything:

1. **Stop write traffic where possible.** Put up a maintenance banner or disable the Vercel deployment if the data is actively being corrupted. Home Base does not ship a built-in maintenance mode — the fastest options are: temporarily revoke the Supabase database password and rotate it, or remove the Vercel deployment's `DATABASE_URL` and redeploy. Both safely 503 the app.
2. **Capture what happened.** Note the timestamp of the incident, the approximate affected tables, and any users who reported the issue. Write it into the shared incident doc before the detail fades.
3. **Check Supabase status.** In the project dashboard, verify the database is reachable at all. If Supabase itself is down, your job is to wait and communicate, not to restore.
4. **Do not run destructive SQL.** `DELETE`, `TRUNCATE`, `DROP`, or restore commands on the live database with no verified backup will make things worse. Every subsequent step assumes you still have the live DB intact while you plan.

---

## 1. Decide the restore window

Supabase PITR can restore to any second within the retention window (7 days on the Pro plan, longer with Point-in-Time Recovery add-ons). Pick the **latest** timestamp you are confident predates the incident. Going further back than necessary throws away legitimate work.

Typical sources of a restore timestamp:

- The last moment the reported-affected workflow looked correct in the product UI.
- The most recent audit-log entry (`AuditLog.createdAt`) before the incident.
- Stripe webhook delivery logs (Stripe dashboard → Developers → Webhooks) if billing events are implicated.

Write the target timestamp down. You will need it in step 2.

---

## 2. Perform the Supabase PITR restore

Supabase restores **to a new database** by default. This is good — the live database stays intact until you decide to cut over.

1. In the Supabase dashboard, go to **Project Settings → Database → Point in Time Recovery**.
2. Enter the target timestamp from step 1. Supabase confirms the resulting restore window.
3. Choose **Restore to a new project**. Name it clearly: `cedar-ridge-recovery-2026-04-22` or similar.
4. Kick off the restore. It takes minutes for small databases, up to an hour for larger ones.

While you wait, do not touch the live project.

---

## 3. Verify the restored project

Once the recovery project is ready:

1. Pull its two connection strings (pooled 6543 + session 5432) from **Project Settings → Database**, exactly as in DEPLOYMENT.md section 1.
2. Point a **local checkout of this repo** at the recovery project:

   ```bash
   export DATABASE_URL="<pooled recovery URL>"
   export POSTGRES_PRISMA_URL="<pooled recovery URL>"
   export POSTGRES_URL_NON_POOLING="<session recovery URL>"
   npx prisma migrate status
   ```

   Migration status should show `Database schema is up to date!`. If it does not, apply pending migrations with `npx prisma migrate deploy`.

3. Point the deploy smoke harness at a temporary Vercel preview wired to the recovery database (Vercel → Create Preview → override the Postgres env vars with the recovery values). Then run:

   ```bash
   HOMEBASE_BASE_URL="https://<preview-domain>" \
   HOMEBASE_API_KEY="<existing key>" \
   npx tsx scripts/deploy-smoke.ts
   ```

   The harness should pass. If it does not, resolve whatever failed before cutting over — a restored database that fails smoke is not ready for production traffic.

4. Spot-check the affected records through the UI on the preview. Confirm the data is what you expected to get back.

---

## 4. Cut over

Once the recovery project is verified:

1. In Vercel, update the production env vars on the live project to point at the **recovery** Supabase project:
   - `DATABASE_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. Trigger a redeploy so the new env values take effect. Home Base reads `DATABASE_URL` at request time, so a deploy is needed to re-pool connections.
3. Re-run `scripts/deploy-smoke.ts` against the production URL.
4. Re-enable write traffic (reverse whatever you did in step 0.1).
5. Announce that service is restored.

Do **not** delete the previous (damaged) Supabase project for at least 48 hours. If the restore turns out to have missed data, you will want to be able to cherry-pick directly from the damaged copy.

---

## 5. Post-incident hygiene

- Rotate any secrets that might have been exposed during the incident — `SESSION_SECRET`, API keys in `/admin/api-keys`, webhook secrets, Stripe webhook signing secret.
- Write a short postmortem in the customer's shared folder. Include the incident summary, the restore target timestamp, the cutover time, any data that was not recoverable, and what you plan to change to prevent a recurrence.
- Revisit PITR retention. If the incident was older than your current retention window would have allowed, extend the add-on.

---

## Things Home Base recovery does NOT cover

- **S3 uploads** (portal photos, Lens video originals). S3 has its own versioning story; enable bucket versioning per deployment. A restored database can reference S3 keys that no longer exist — plan for that.
- **Stripe state.** Subscription truth lives in Stripe. If you restore an old database, Home Base will re-ingest whatever Stripe events it missed as soon as they are redelivered (Stripe → Webhooks → Resend). You do not need to manually reconcile the `Subscription` table.
- **External email delivery status.** Restored `EmailSend` rows will show their historical status; the actual emails were already delivered or failed at the provider.

If you need help, start with [DEPLOYMENT.md](DEPLOYMENT.md), then inspect [prisma/schema.prisma](prisma/schema.prisma) for table relationships and [tests/](tests/) for expected behavior.
