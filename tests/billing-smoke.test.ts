import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  ingestStripeEvent,
  subscriptionNeedsAttention,
  type StripeEvent,
} from "@/lib/billing/subscription";
import { verifyStripeSignature } from "@/lib/billing/signature";

async function main() {
  unitTests();
  await ingestionTests();
  await webhookRouteTests();
  console.log("Billing smoke test: OK");
}

function unitTests() {
  const secret = `whsec_${randomBytes(16).toString("hex")}`;
  const rawBody = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated" });
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const signed = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const header = `t=${timestamp},v1=${signed}`;

  assert.equal(
    verifyStripeSignature(secret, rawBody, header, { now }),
    true,
    "matching signature should verify",
  );

  const tamperedBody = rawBody + "x";
  assert.equal(
    verifyStripeSignature(secret, tamperedBody, header, { now }),
    false,
    "tampered body should fail verification",
  );

  assert.equal(
    verifyStripeSignature(secret, rawBody, `t=${timestamp},v1=deadbeef`, { now }),
    false,
    "wrong digest should fail verification",
  );

  const staleTs = (Math.floor(now.getTime() / 1000) - 10 * 60).toString();
  const staleSigned = createHmac("sha256", secret)
    .update(`${staleTs}.${rawBody}`)
    .digest("hex");
  assert.equal(
    verifyStripeSignature(secret, rawBody, `t=${staleTs},v1=${staleSigned}`, { now }),
    false,
    "timestamp outside tolerance window should fail",
  );

  assert.equal(
    subscriptionNeedsAttention(SubscriptionStatus.PAST_DUE),
    true,
    "past-due should need attention",
  );
  assert.equal(
    subscriptionNeedsAttention(SubscriptionStatus.ACTIVE),
    false,
    "active should not need attention",
  );
  assert.equal(
    subscriptionNeedsAttention(SubscriptionStatus.TRIALING),
    false,
    "trialing should not need attention",
  );
}

async function ingestionTests() {
  const subId = `sub_${randomUUID().slice(0, 12)}`;
  const custId = `cus_${randomUUID().slice(0, 12)}`;
  const createdTs = Math.floor(Date.now() / 1000);

  const createdEvent: StripeEvent = {
    id: `evt_created_${randomUUID().slice(0, 8)}`,
    type: "customer.subscription.created",
    created: createdTs,
    data: {
      object: {
        id: subId,
        customer: custId,
        status: "active",
        current_period_start: createdTs,
        current_period_end: createdTs + 30 * 86_400,
        cancel_at_period_end: false,
      },
    },
  };

  try {
    const createResult = await ingestStripeEvent(createdEvent);
    assert.equal(createResult.action, "created", "first event should create the subscription");
    assert.equal(createResult.status, SubscriptionStatus.ACTIVE);

    // Replaying the same Stripe event id is a no-op.
    const duplicate = await ingestStripeEvent(createdEvent);
    assert.equal(duplicate.action, "duplicate", "replay of same event id should be a duplicate");

    // Past-due invoice event transitions the subscription to PAST_DUE.
    const pastDueEvent: StripeEvent = {
      id: `evt_past_due_${randomUUID().slice(0, 8)}`,
      type: "invoice.payment_failed",
      created: createdTs + 60,
      data: {
        object: {
          id: `in_${randomUUID().slice(0, 10)}`,
          subscription: subId,
          customer: custId,
          status: "past_due",
        },
      },
    };
    const pastDueResult = await ingestStripeEvent(pastDueEvent);
    assert.equal(pastDueResult.action, "updated", "payment_failed should update the subscription");
    assert.equal(pastDueResult.status, SubscriptionStatus.PAST_DUE);

    // An older event (out of order) should not overwrite the current state.
    const staleEvent: StripeEvent = {
      id: `evt_stale_${randomUUID().slice(0, 8)}`,
      type: "customer.subscription.updated",
      created: createdTs - 60,
      data: {
        object: {
          id: subId,
          customer: custId,
          status: "active",
          current_period_start: createdTs - 60,
          current_period_end: createdTs + 30 * 86_400,
          cancel_at_period_end: false,
        },
      },
    };
    const staleResult = await ingestStripeEvent(staleEvent);
    assert.equal(staleResult.action, "ignored", "older event should not overwrite newer state");
    assert.equal(staleResult.status, SubscriptionStatus.PAST_DUE);

    // Payment success flips it back to ACTIVE.
    const paymentOkEvent: StripeEvent = {
      id: `evt_paid_${randomUUID().slice(0, 8)}`,
      type: "invoice.payment_succeeded",
      created: createdTs + 120,
      data: {
        object: {
          id: `in_${randomUUID().slice(0, 10)}`,
          subscription: subId,
          customer: custId,
          status: "paid",
        },
      },
    };
    const paidResult = await ingestStripeEvent(paymentOkEvent);
    assert.equal(paidResult.action, "updated");
    assert.equal(paidResult.status, SubscriptionStatus.ACTIVE);

    // Unknown event types are still recorded but marked ignored.
    const unknownEvent: StripeEvent = {
      id: `evt_unknown_${randomUUID().slice(0, 8)}`,
      type: "charge.refunded",
      created: createdTs + 200,
      data: { object: {} },
    };
    const unknownResult = await ingestStripeEvent(unknownEvent);
    assert.equal(unknownResult.action, "ignored", "unhandled event should be ignored");

    const persisted = await db.subscription.findUnique({ where: { stripeSubscriptionId: subId } });
    assert.ok(persisted, "subscription row should still exist");
    assert.equal(persisted?.status, SubscriptionStatus.ACTIVE, "final status should be ACTIVE");

    const eventRows = await db.billingEvent.findMany({
      where: { stripeEventId: { in: [createdEvent.id, pastDueEvent.id, paymentOkEvent.id, unknownEvent.id] } },
    });
    assert.equal(eventRows.length, 4, "every unique event should be persisted once");
    for (const row of eventRows) {
      assert.ok(row.processedAt, `event ${row.stripeEventId} should be marked processed`);
    }
  } finally {
    await db.subscription.deleteMany({ where: { stripeSubscriptionId: subId } });
    await db.billingEvent.deleteMany({
      where: { stripeEventId: { startsWith: "evt_" } },
    });
  }
}

async function webhookRouteTests() {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    // No secret -> 503.
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const unconfigured = await stripeWebhook(
      new Request("http://homebase.local/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }),
    );
    assert.equal(unconfigured.status, 503, "missing STRIPE_WEBHOOK_SECRET should 503");

    // Bad signature -> 400.
    const secret = `whsec_${randomBytes(16).toString("hex")}`;
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const rawBody = JSON.stringify({
      id: `evt_route_${randomUUID().slice(0, 8)}`,
      type: "customer.subscription.created",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `sub_${randomUUID().slice(0, 10)}`,
          customer: `cus_${randomUUID().slice(0, 10)}`,
          status: "active",
        },
      },
    });

    const badSigRes = await stripeWebhook(
      new Request("http://homebase.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=0,v1=deadbeef" },
        body: rawBody,
      }),
    );
    assert.equal(badSigRes.status, 400, "invalid signature should 400");

    // Valid signature + valid event -> 200 and persists a subscription row.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signed = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    const okRes = await stripeWebhook(
      new Request("http://homebase.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": `t=${timestamp},v1=${signed}` },
        body: rawBody,
      }),
    );
    assert.equal(okRes.status, 200, "valid webhook should 200");
    const okBody = (await okRes.json()) as { received: boolean; result: { action: string } };
    assert.equal(okBody.received, true);
    assert.equal(okBody.result.action, "created");

    const parsed = JSON.parse(rawBody) as { id: string };
    await db.billingEvent.deleteMany({ where: { stripeEventId: parsed.id } });
    await db.subscription.deleteMany({
      where: {
        stripeSubscriptionId: (JSON.parse(rawBody).data.object as { id: string }).id,
      },
    });
  } finally {
    if (originalSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
