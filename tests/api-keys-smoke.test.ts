import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GET as listCustomers } from "@/app/api/public/v1/customers/route";
import { GET as listEstimates } from "@/app/api/public/v1/estimates/route";
import { GET as listVehicles } from "@/app/api/public/v1/vehicles/route";
import { GET as listWorkOrders } from "@/app/api/public/v1/work-orders/route";
import { db } from "@/lib/db";
import {
  hashApiKey,
  issueApiKey,
  API_KEY_PREFIX,
} from "@/lib/api-keys/authenticate";
import { issueApiKeyForAdmin, revokeApiKey } from "@/lib/api-keys/admin";
import {
  API_KEY_RATE_LIMIT_PER_MINUTE,
  enforceApiKeyRateLimit,
  gcApiKeyUsage,
} from "@/lib/api-keys/rate-limit";
import { sanitizeScopes } from "@/lib/api-keys/scopes";
import { HttpError } from "@/lib/auth";

async function main() {
  unitTests();
  await adminFlowTest();
  await publicEndpointTests();
  await rateLimitTests();
  console.log("API keys smoke test: OK");
}

function unitTests() {
  const issued = issueApiKey();
  assert.ok(issued.plaintext.startsWith(API_KEY_PREFIX), "plaintext should use the hbk_ prefix");
  assert.equal(issued.lastFour.length, 4, "lastFour should be four chars");
  assert.equal(issued.hashedKey, hashApiKey(issued.plaintext), "hash should be deterministic");
  assert.ok(
    !issued.hashedKey.startsWith(API_KEY_PREFIX),
    "hashed key should not retain the plaintext prefix",
  );

  // Same plaintext -> same hash; different plaintext -> different hash.
  const second = issueApiKey();
  assert.notEqual(issued.hashedKey, second.hashedKey, "two issued keys should hash differently");

  // Scope sanitization trims, dedupes, and drops unknown entries.
  const cleaned = sanitizeScopes([
    "customers.read",
    " vehicles.read ",
    "not-a-scope",
    "customers.read",
  ]);
  assert.deepEqual(cleaned, ["customers.read", "vehicles.read"]);
}

async function adminFlowTest() {
  const ids: string[] = [];
  try {
    const created = await issueApiKeyForAdmin({
      label: `Admin flow ${randomUUID().slice(0, 6)}`,
      scopes: ["customers.read"],
    });
    ids.push(created.key.id);

    const persisted = await db.apiKey.findUnique({ where: { id: created.key.id } });
    assert.ok(persisted, "issued key should persist");
    assert.notEqual(
      persisted?.hashedKey,
      created.plaintext,
      "persisted row should store the hash, not the plaintext",
    );
    assert.equal(
      persisted?.lastFour,
      created.plaintext.slice(-4),
      "lastFour should match the plaintext suffix",
    );

    const revoked = await revokeApiKey(created.key.id);
    assert.ok(revoked.revokedAt, "revoked key should have a revokedAt timestamp");

    await assert.rejects(
      issueApiKeyForAdmin({ label: "", scopes: ["customers.read"] }),
      /Label is required/,
      "blank label should be rejected",
    );
    await assert.rejects(
      issueApiKeyForAdmin({ label: "No scopes", scopes: [] }),
      /at least one scope/,
      "empty scope list should be rejected",
    );
  } finally {
    if (ids.length > 0) {
      await db.apiKey.deleteMany({ where: { id: { in: ids } } });
    }
  }
}

async function publicEndpointTests() {
  const suffix = randomUUID().slice(0, 8);
  const ids: {
    keys: string[];
    customers: string[];
    vehicles: string[];
    workOrders: string[];
    estimates: string[];
  } = {
    keys: [],
    customers: [],
    vehicles: [],
    workOrders: [],
    estimates: [],
  };

  try {
    // Seed a customer, vehicle, work order, and estimate so the endpoints have something to show.
    const customer = await db.customer.create({
      data: { displayName: `Public API Customer ${suffix}` },
    });
    ids.customers.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2024,
        make: "Ford",
        model: "F-650",
        unitNumber: `PUB-${suffix}`,
      },
    });
    ids.vehicles.push(vehicle.id);

    const workOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-PUB-${suffix}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "OPEN",
        priority: "NORMAL",
        title: "Public API probe work order",
        openedAt: new Date(),
        lineItems: {
          create: [
            {
              lineType: "LABOR",
              status: "OPEN",
              description: "Diag",
              quantity: 1,
              unitPrice: 100,
              lineTotal: 100,
              taxable: false,
            },
          ],
        },
      },
    });
    ids.workOrders.push(workOrder.id);

    const estimate = await db.estimate.create({
      data: {
        estimateNumber: `EST-PUB-${suffix}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "APPROVED",
        title: `Public API estimate ${suffix}`,
        subtotal: 250,
        taxTotal: 0,
        total: 250,
        approvedAt: new Date(),
      },
    });
    ids.estimates.push(estimate.id);

    // Issue a key with every scope we expect to use, plus a scoped-only key and a revoked key.
    const fullAccess = await issueApiKeyForAdmin({
      label: `Public probe full ${suffix}`,
      scopes: ["customers.read", "vehicles.read", "work-orders.read", "estimates.read"],
    });
    ids.keys.push(fullAccess.key.id);

    const scopedOnly = await issueApiKeyForAdmin({
      label: `Public probe scoped ${suffix}`,
      scopes: ["customers.read"],
    });
    ids.keys.push(scopedOnly.key.id);

    const toRevoke = await issueApiKeyForAdmin({
      label: `Public probe revoked ${suffix}`,
      scopes: ["customers.read"],
    });
    ids.keys.push(toRevoke.key.id);
    await revokeApiKey(toRevoke.key.id);

    // Missing Authorization header -> 401.
    const missingAuth = await listCustomers(
      new Request("http://homebase.local/api/public/v1/customers"),
    );
    assert.equal(missingAuth.status, 401, "missing auth header should 401");

    // Bad key format -> 401.
    const badAuth = await listCustomers(
      new Request("http://homebase.local/api/public/v1/customers", {
        headers: { authorization: "Bearer not-a-homebase-key" },
      }),
    );
    assert.equal(badAuth.status, 401, "unrecognized key prefix should 401");

    // Revoked key -> 401.
    const revokedAuth = await listCustomers(
      new Request("http://homebase.local/api/public/v1/customers", {
        headers: { authorization: `Bearer ${toRevoke.plaintext}` },
      }),
    );
    assert.equal(revokedAuth.status, 401, "revoked key should 401");

    // Scoped-only key trying to read vehicles -> 403.
    const wrongScope = await listVehicles(
      new Request("http://homebase.local/api/public/v1/vehicles", {
        headers: { authorization: `Bearer ${scopedOnly.plaintext}` },
      }),
    );
    assert.equal(wrongScope.status, 403, "scoped key should be rejected on the wrong endpoint");

    // Full-access key succeeds on every endpoint and returns the seeded record.
    const fullHeaders = { authorization: `Bearer ${fullAccess.plaintext}` };

    const customersRes = await listCustomers(
      new Request("http://homebase.local/api/public/v1/customers?limit=5", {
        headers: fullHeaders,
      }),
    );
    assert.equal(customersRes.status, 200, "customers endpoint should 200 with full access");
    const customersBody = (await customersRes.json()) as {
      data: Array<{ id: string }>;
      meta: { total: number; limit: number; offset: number };
    };
    assert.equal(customersBody.meta.limit, 5, "limit should round-trip");
    assert.ok(
      customersBody.data.some((row) => row.id === customer.id),
      "response should contain the seeded customer",
    );

    const vehiclesRes = await listVehicles(
      new Request(
        `http://homebase.local/api/public/v1/vehicles?customerId=${customer.id}`,
        { headers: fullHeaders },
      ),
    );
    assert.equal(vehiclesRes.status, 200);
    const vehiclesBody = (await vehiclesRes.json()) as {
      data: Array<{ id: string; customerId: string }>;
    };
    assert.ok(
      vehiclesBody.data.every((row) => row.customerId === customer.id),
      "vehicles response should be scoped to the requested customer",
    );
    assert.ok(
      vehiclesBody.data.some((row) => row.id === vehicle.id),
      "seeded vehicle should be returned",
    );

    const workOrdersRes = await listWorkOrders(
      new Request(
        `http://homebase.local/api/public/v1/work-orders?customerId=${customer.id}`,
        { headers: fullHeaders },
      ),
    );
    assert.equal(workOrdersRes.status, 200);
    const workOrdersBody = (await workOrdersRes.json()) as {
      data: Array<{ id: string; subtotal: number; lineItemCount: number }>;
    };
    const seededWo = workOrdersBody.data.find((row) => row.id === workOrder.id);
    assert.ok(seededWo, "seeded work order should appear in response");
    assert.equal(seededWo?.subtotal, 100, "subtotal should sum the single line item");
    assert.equal(seededWo?.lineItemCount, 1, "lineItemCount should match the seeded count");

    const estimatesRes = await listEstimates(
      new Request(
        `http://homebase.local/api/public/v1/estimates?customerId=${customer.id}&status=APPROVED`,
        { headers: fullHeaders },
      ),
    );
    assert.equal(estimatesRes.status, 200);
    const estimatesBody = (await estimatesRes.json()) as {
      data: Array<{ id: string; status: string; total: number }>;
    };
    assert.ok(
      estimatesBody.data.some((row) => row.id === estimate.id && row.status === "APPROVED"),
      "approved estimate should appear in response",
    );

    // lastUsedAt gets updated after a real call.
    const persistedKey = await db.apiKey.findUnique({ where: { id: fullAccess.key.id } });
    assert.ok(
      persistedKey?.lastUsedAt,
      "lastUsedAt should be populated after a successful call",
    );
  } finally {
    if (ids.estimates.length > 0) {
      await db.estimate.deleteMany({ where: { id: { in: ids.estimates } } });
    }
    if (ids.workOrders.length > 0) {
      await db.workOrderLineItem.deleteMany({
        where: { workOrderId: { in: ids.workOrders } },
      });
      await db.workOrder.deleteMany({ where: { id: { in: ids.workOrders } } });
    }
    if (ids.vehicles.length > 0) {
      await db.vehicle.deleteMany({ where: { id: { in: ids.vehicles } } });
    }
    if (ids.customers.length > 0) {
      await db.customer.deleteMany({ where: { id: { in: ids.customers } } });
    }
    if (ids.keys.length > 0) {
      await db.apiKey.deleteMany({ where: { id: { in: ids.keys } } });
    }
    await db.$disconnect();
  }
}

async function rateLimitTests() {
  const key = await issueApiKeyForAdmin({
    label: `Rate limit probe ${randomUUID().slice(0, 6)}`,
    scopes: ["customers.read"],
  });
  // First half of the test uses a frozen clock so we can assert the counter
  // math without racing the real minute rollover.
  const frozen = new Date("2030-06-01T12:00:00.000Z");

  try {
    for (let i = 0; i < API_KEY_RATE_LIMIT_PER_MINUTE; i += 1) {
      const snapshot = await enforceApiKeyRateLimit(key.key.id, frozen);
      assert.equal(snapshot.limit, API_KEY_RATE_LIMIT_PER_MINUTE);
      assert.equal(
        snapshot.remaining,
        API_KEY_RATE_LIMIT_PER_MINUTE - (i + 1),
        `remaining should count down (expected ${API_KEY_RATE_LIMIT_PER_MINUTE - (i + 1)}, got ${snapshot.remaining})`,
      );
    }

    // One more request inside the same frozen minute should 429.
    await assert.rejects(
      enforceApiKeyRateLimit(key.key.id, frozen),
      (error: unknown) => error instanceof HttpError && error.status === 429,
      "requests beyond the per-minute quota should throw 429",
    );

    // Now drive the *real* current minute to the limit so a real route call
    // surfaces the 429 path with its headers. Routes use the system clock, so
    // we have to exhaust the current minute bucket too.
    const realNow = new Date();
    for (let i = 0; i < API_KEY_RATE_LIMIT_PER_MINUTE; i += 1) {
      await enforceApiKeyRateLimit(key.key.id, realNow);
    }

    const response = await listCustomers(
      new Request("http://homebase.local/api/public/v1/customers", {
        headers: { authorization: `Bearer ${key.plaintext}` },
      }),
    );
    assert.equal(response.status, 429, "exhausted key should get 429 from the route");
    assert.equal(
      response.headers.get("retry-after"),
      "60",
      "429 response should include Retry-After: 60",
    );
    assert.equal(
      response.headers.get("x-ratelimit-limit"),
      String(API_KEY_RATE_LIMIT_PER_MINUTE),
      "429 response should advertise the rate limit",
    );

    // gcApiKeyUsage should clear stale rows outside the retention window.
    const staleWindow = new Date("2029-01-01T00:00:00.000Z");
    await db.apiKeyUsage.create({
      data: {
        apiKeyId: key.key.id,
        windowStart: staleWindow,
        requestCount: 5,
      },
    });
    const cleaned = await gcApiKeyUsage(24 * 60 * 60 * 1000, frozen);
    assert.ok(cleaned >= 1, "gc should remove at least one stale window");
    const remainingStale = await db.apiKeyUsage.findFirst({
      where: { apiKeyId: key.key.id, windowStart: staleWindow },
    });
    assert.equal(remainingStale, null, "stale window row should be gone after gc");

    // Sanity: a freshly issued key starts with full headroom on its first call.
    const freshKey = await issueApiKeyForAdmin({
      label: `Rate limit fresh ${randomUUID().slice(0, 6)}`,
      scopes: ["customers.read"],
    });
    try {
      const freshResponse = await listCustomers(
        new Request("http://homebase.local/api/public/v1/customers", {
          headers: { authorization: `Bearer ${freshKey.plaintext}` },
        }),
      );
      assert.equal(freshResponse.status, 200, "fresh key should succeed on first call");
      assert.equal(
        freshResponse.headers.get("x-ratelimit-remaining"),
        String(API_KEY_RATE_LIMIT_PER_MINUTE - 1),
        "first call on a fresh key should leave limit-minus-one remaining",
      );
    } finally {
      await db.apiKeyUsage.deleteMany({ where: { apiKeyId: freshKey.key.id } });
      await db.apiKey.deleteMany({ where: { id: freshKey.key.id } });
    }
  } finally {
    await db.apiKeyUsage.deleteMany({ where: { apiKeyId: key.key.id } });
    await db.apiKey.deleteMany({ where: { id: key.key.id } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
