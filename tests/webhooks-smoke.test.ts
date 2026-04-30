import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import { WebhookDeliveryStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { backoffMs, emitWebhook, processPendingDeliveries } from "@/lib/webhooks/dispatch";
import {
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_EVENT_TYPE_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  issueWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/webhooks/signing";

type Recorded = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

type TestServer = {
  url: (path: string) => string;
  close: () => Promise<void>;
  setHandler: (
    handler: (req: IncomingMessage, res: ServerResponse, recorded: Recorded) => void,
  ) => void;
  recorded: Recorded[];
};

async function startTestServer(): Promise<TestServer> {
  const recorded: Recorded[] = [];
  let currentHandler: (
    req: IncomingMessage,
    res: ServerResponse,
    recorded: Recorded,
  ) => void = (_req, res) => {
    res.statusCode = 200;
    res.end("ok");
  };

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const entry: Recorded = { method: req.method ?? "", headers: req.headers, body };
      recorded.push(entry);
      currentHandler(req, res, entry);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  return {
    recorded,
    url: (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    setHandler: (handler) => {
      currentHandler = handler;
    },
  };
}

async function main() {
  unitTests();
  const server = await startTestServer();
  const created: { endpointIds: string[] } = { endpointIds: [] };

  try {
    await dispatchSuccessTest(server, created);
    await dispatchFailureRetryTest(server, created);
    await dispatchNonMatchingEventTest(server, created);
  } finally {
    await cleanup(created);
    await server.close();
  }
  console.log("Webhooks smoke test: OK");
}

function unitTests() {
  const secret = issueWebhookSecret();
  assert.ok(secret.startsWith("whsec_"), "issued secret should use the whsec_ prefix");

  const timestamp = "2026-04-22T00:00:00.000Z";
  const body = JSON.stringify({ hello: "world" });
  const signature = signWebhookPayload(secret, timestamp, body);
  assert.ok(signature.startsWith(`t=${timestamp},v1=`), "signature should include t and v1 parts");

  assert.equal(
    verifyWebhookSignature(secret, timestamp, body, signature),
    true,
    "matching signature should verify",
  );
  assert.equal(
    verifyWebhookSignature(secret, timestamp, body, signature.replace("v1=", "v1=tampered")),
    false,
    "tampered signature should fail verification",
  );
  assert.equal(
    verifyWebhookSignature(secret, timestamp, `${body}x`, signature),
    false,
    "tampered body should fail verification",
  );
  assert.equal(
    verifyWebhookSignature(secret, "2026-04-22T00:00:01.000Z", body, signature),
    false,
    "mismatched timestamp should fail verification",
  );

  assert.equal(backoffMs(1), 60_000, "first retry should wait one minute");
  assert.equal(backoffMs(2), 5 * 60_000, "second retry should wait five minutes");
  assert.equal(backoffMs(10), 24 * 60 * 60_000, "attempts beyond the ladder should clamp to 24h");
}

async function dispatchSuccessTest(server: TestServer, created: { endpointIds: string[] }) {
  const secretMarker = `success-${randomUUID().slice(0, 6)}`;
  const endpoint = await db.webhookEndpoint.create({
    data: {
      label: `Success ${secretMarker}`,
      url: server.url("/success"),
      secret: issueWebhookSecret(),
      enabled: true,
      eventTypesJson: ["work_order.status_changed"],
    },
  });
  created.endpointIds.push(endpoint.id);

  server.setHandler((_req, res) => {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain");
    res.end("accepted");
  });

  const { eventId, queued } = await emitWebhook({
    eventType: "work_order.status_changed",
    payload: {
      workOrderId: "wo-smoke-1",
      fromStatus: "OPEN",
      toStatus: "IN_PROGRESS",
    },
  });
  assert.equal(queued, 1, "matching endpoint should receive one queued delivery");
  assert.ok(eventId, "emit should return an event id");

  const results = await processPendingDeliveries(10);
  const relevant = results.filter((entry) => entry.status === WebhookDeliveryStatus.SUCCEEDED);
  assert.ok(relevant.length >= 1, "at least one delivery should succeed");

  const delivery = await db.webhookDelivery.findFirst({
    where: { endpointId: endpoint.id, eventId },
  });
  assert.ok(delivery, "delivery row should exist");
  assert.equal(delivery?.status, WebhookDeliveryStatus.SUCCEEDED, "delivery should be SUCCEEDED");
  assert.equal(delivery?.attemptCount, 1, "successful delivery should record attemptCount=1");
  assert.equal(delivery?.responseStatus, 200, "response status should be captured");

  const last = server.recorded[server.recorded.length - 1];
  assert.ok(last, "the test server should have received one request");
  assert.equal(last.method, "POST", "delivery should be a POST");
  assert.equal(
    last.headers[WEBHOOK_EVENT_TYPE_HEADER],
    "work_order.status_changed",
    "event type header should be present",
  );
  assert.equal(
    last.headers[WEBHOOK_EVENT_ID_HEADER],
    eventId,
    "event id header should match the emitted event id",
  );
  const signatureHeader = last.headers[WEBHOOK_SIGNATURE_HEADER];
  const timestampHeader = last.headers[WEBHOOK_TIMESTAMP_HEADER];
  assert.ok(signatureHeader && typeof signatureHeader === "string", "signature header should be a string");
  assert.ok(timestampHeader && typeof timestampHeader === "string", "timestamp header should be a string");

  assert.equal(
    verifyWebhookSignature(
      endpoint.secret,
      timestampHeader as string,
      last.body,
      signatureHeader as string,
    ),
    true,
    "signature on the delivered request should verify against the endpoint secret",
  );
}

async function dispatchFailureRetryTest(server: TestServer, created: { endpointIds: string[] }) {
  const marker = `retry-${randomUUID().slice(0, 6)}`;
  const endpoint = await db.webhookEndpoint.create({
    data: {
      label: `Retry ${marker}`,
      url: server.url("/fail"),
      secret: issueWebhookSecret(),
      enabled: true,
      eventTypesJson: ["estimate.approved"],
    },
  });
  created.endpointIds.push(endpoint.id);

  server.setHandler((_req, res) => {
    res.statusCode = 500;
    res.end("nope");
  });

  const { eventId } = await emitWebhook({
    eventType: "estimate.approved",
    payload: { estimateId: "est-smoke-1" },
  });

  const attemptedAt = new Date();
  await processPendingDeliveries(10);

  const row = await db.webhookDelivery.findFirst({
    where: { endpointId: endpoint.id, eventId },
  });
  assert.ok(row, "retry delivery row should exist");
  assert.equal(row?.status, WebhookDeliveryStatus.PENDING, "5xx should requeue as PENDING");
  assert.equal(row?.attemptCount, 1, "failed delivery should increment attemptCount to 1");
  assert.equal(row?.responseStatus, 500, "response status should be captured on failure");
  assert.ok(row?.errorMessage, "failure should record an error message");
  const nextAttempt = row?.nextAttemptAt?.getTime() ?? 0;
  assert.ok(
    nextAttempt > attemptedAt.getTime() + 30_000,
    "next attempt should be scheduled at least 30s in the future",
  );
}

async function dispatchNonMatchingEventTest(
  server: TestServer,
  created: { endpointIds: string[] },
) {
  const marker = `skip-${randomUUID().slice(0, 6)}`;
  const endpoint = await db.webhookEndpoint.create({
    data: {
      label: `Skip ${marker}`,
      url: server.url("/skip"),
      secret: issueWebhookSecret(),
      enabled: true,
      eventTypesJson: ["estimate.approved"],
    },
  });
  created.endpointIds.push(endpoint.id);

  const recordedBefore = server.recorded.length;
  const { queued, eventId } = await emitWebhook({
    eventType: "portal.upload_received",
    payload: { uploadId: "u1" },
  });
  assert.ok(queued === 0 || !(await endpointReceivedEvent(endpoint.id, eventId)),
    "endpoints that do not subscribe to an event should not receive it",
  );

  await processPendingDeliveries(10);
  // No new request should have been recorded for the skip endpoint's URL.
  const newEntries = server.recorded.slice(recordedBefore);
  const hitSkipUrl = newEntries.some((entry) => entry.headers["x-homebase-event"] === "portal.upload_received");
  assert.equal(hitSkipUrl, false, "a non-matching endpoint should not be hit");
}

async function endpointReceivedEvent(endpointId: string, eventId: string): Promise<boolean> {
  const row = await db.webhookDelivery.findFirst({
    where: { endpointId, eventId },
  });
  return Boolean(row);
}

async function cleanup(created: { endpointIds: string[] }) {
  if (created.endpointIds.length > 0) {
    await db.webhookDelivery.deleteMany({
      where: { endpointId: { in: created.endpointIds } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { id: { in: created.endpointIds } },
    });
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
