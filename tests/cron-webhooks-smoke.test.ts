import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { GET as processCron, POST as processCronPost } from "@/app/api/cron/process-webhooks/route";
import { WebhookDeliveryStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { issueWebhookSecret } from "@/lib/webhooks/signing";

async function main() {
  const originalSecret = process.env.CRON_SECRET;
  const endpointIds: string[] = [];
  try {
    // 503 when not configured.
    delete process.env.CRON_SECRET;
    const unconfigured = await processCron(
      new Request("http://homebase.local/api/cron/process-webhooks"),
    );
    assert.equal(unconfigured.status, 503, "missing CRON_SECRET should 503");

    const secret = randomBytes(32).toString("hex");
    process.env.CRON_SECRET = secret;

    // 401 without header.
    const noHeader = await processCron(
      new Request("http://homebase.local/api/cron/process-webhooks"),
    );
    assert.equal(noHeader.status, 401, "missing Authorization header should 401");

    // 401 with wrong secret.
    const wrongSecret = await processCron(
      new Request("http://homebase.local/api/cron/process-webhooks", {
        headers: { authorization: "Bearer not-the-real-secret" },
      }),
    );
    assert.equal(wrongSecret.status, 401, "mismatched secret should 401");

    // Seed a disabled endpoint so processPendingDeliveries has nothing real to chew on.
    const endpoint = await db.webhookEndpoint.create({
      data: {
        label: `cron-smoke-${randomUUID().slice(0, 6)}`,
        url: "http://127.0.0.1:65534/will-not-be-called",
        secret: issueWebhookSecret(),
        enabled: false,
        eventTypesJson: ["work_order.status_changed"],
      },
    });
    endpointIds.push(endpoint.id);

    // 200 on GET with valid secret.
    const getRes = await processCron(
      new Request("http://homebase.local/api/cron/process-webhooks", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    assert.equal(getRes.status, 200, "valid GET should 200");
    const body = (await getRes.json()) as {
      processed: number;
      succeeded: number;
      pending: number;
      permanentlyFailed: number;
    };
    assert.ok(typeof body.processed === "number", "body should include processed count");
    assert.ok(
      body.processed === 0 ||
        body.succeeded + body.pending + body.permanentlyFailed <= body.processed,
      "status counts should not exceed processed total",
    );

    // POST also works so external pingers and Vercel Cron can both hit it.
    const postRes = await processCronPost(
      new Request("http://homebase.local/api/cron/process-webhooks", {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    assert.equal(postRes.status, 200, "valid POST should 200");

    // Any PENDING delivery on a disabled endpoint stays PENDING (processPendingDeliveries
    // filters to deletedAt:null + enabled:true endpoints).
    const probe = await db.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventType: "work_order.status_changed",
        eventId: randomUUID(),
        payloadJson: { test: true },
        status: WebhookDeliveryStatus.PENDING,
      },
    });
    await processCron(
      new Request("http://homebase.local/api/cron/process-webhooks", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    const after = await db.webhookDelivery.findUnique({ where: { id: probe.id } });
    assert.equal(
      after?.status,
      WebhookDeliveryStatus.PENDING,
      "delivery on a disabled endpoint should stay pending",
    );

    console.log("Cron webhooks smoke test: OK");
  } finally {
    if (endpointIds.length > 0) {
      await db.webhookDelivery.deleteMany({ where: { endpointId: { in: endpointIds } } });
      await db.webhookEndpoint.deleteMany({ where: { id: { in: endpointIds } } });
    }
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
