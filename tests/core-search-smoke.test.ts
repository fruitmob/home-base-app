import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { POST as importCoreEntities } from "@/app/api/imports/core-entities/route";
import { GET as searchCoreEntities } from "@/app/api/search/core-entities/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const csrfToken = "core-search-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type CoreSearchPayload = {
  query: string;
  results: Array<{
    type: "customer" | "contact" | "vehicle" | "vendor" | "lead" | "opportunity" | "quote" | "case";
    id: string;
    label: string;
    subtitle: string;
    href: string;
    metadata: Record<string, unknown>;
  }>;
  counts: {
    customers: number;
    contacts: number;
    vehicles: number;
    vendors: number;
    leads: number;
    opportunities: number;
    quotes: number;
    cases: number;
    total: number;
  };
};

async function main() {
  const token = `SEARCH${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const session = await createTestSession(Role.VIEWER, token);
  const customerIds: string[] = [];
  const vendorIds: string[] = [];

  try {
    const activeCustomer = await db.customer.create({
      data: {
        customerType: "BUSINESS",
        displayName: `${token} Fleet`,
        companyName: `${token} Fleet`,
        email: `${token.toLowerCase()}@customer.example.test`,
      },
    });
    const deletedCustomer = await db.customer.create({
      data: {
        customerType: "BUSINESS",
        displayName: `${token} Deleted Customer`,
        companyName: `${token} Deleted Customer`,
        deletedAt: new Date(),
      },
    });
    customerIds.push(activeCustomer.id, deletedCustomer.id);

    const activeVendor = await db.vendor.create({
      data: {
        vendorType: "PARTS",
        name: `${token} Parts`,
        email: `${token.toLowerCase()}@vendor.example.test`,
      },
    });
    const deletedVendor = await db.vendor.create({
      data: {
        vendorType: "PARTS",
        name: `${token} Deleted Vendor`,
        deletedAt: new Date(),
      },
    });
    vendorIds.push(activeVendor.id, deletedVendor.id);

    const activeContact = await db.contact.create({
      data: {
        customerId: activeCustomer.id,
        displayName: `${token} Coordinator`,
        firstName: token,
        lastName: "Coordinator",
        email: `${token.toLowerCase()}@contact.example.test`,
      },
    });
    const deletedContact = await db.contact.create({
      data: {
        customerId: activeCustomer.id,
        displayName: `${token} Deleted Contact`,
        deletedAt: new Date(),
      },
    });
    const deletedOwnerContact = await db.contact.create({
      data: {
        customerId: deletedCustomer.id,
        displayName: `${token} Deleted Owner Contact`,
      },
    });

    const activeVehicle = await db.vehicle.create({
      data: {
        customerId: activeCustomer.id,
        unitNumber: `${token}-UNIT`,
        make: "Ford",
        model: "Transit",
      },
    });
    const deletedVehicle = await db.vehicle.create({
      data: {
        customerId: activeCustomer.id,
        unitNumber: `${token}-DELETED-UNIT`,
        deletedAt: new Date(),
      },
    });

    const unauthenticatedSearch = await searchCoreEntities(
      new Request(`http://homebase.local/api/search/core-entities?q=${token}`),
    );
    await expectStatus(unauthenticatedSearch, 401, "unauthenticated search");

    const emptySearch = await searchCoreEntities(
      authedRequest("http://homebase.local/api/search/core-entities", "GET", session.sessionId),
    );
    await expectStatus(emptySearch, 200, "empty search");
    const emptyPayload = await readJson<CoreSearchPayload>(emptySearch);
    assert.equal(emptyPayload.counts.total, 0);

    const searchResponse = await searchCoreEntities(
      authedRequest(
        `http://homebase.local/api/search/core-entities?q=${encodeURIComponent(token.toLowerCase())}`,
        "GET",
        session.sessionId,
      ),
    );
    await expectStatus(searchResponse, 200, "mixed core search");
    const payload = await readJson<CoreSearchPayload>(searchResponse);

    assert.equal(payload.query, token.toLowerCase());
    assert.equal(payload.counts.customers, 1);
    assert.equal(payload.counts.contacts, 1);
    assert.equal(payload.counts.vehicles, 1);
    assert.equal(payload.counts.vendors, 1);
    assert.equal(payload.counts.leads, 0);
    assert.equal(payload.counts.opportunities, 0);
    assert.equal(payload.counts.quotes, 0);
    assert.equal(payload.counts.cases, 0);
    assert.equal(payload.counts.total, 4);
    assertResult(payload, "customer", activeCustomer.id, `/customers/${activeCustomer.id}`);
    assertResult(payload, "contact", activeContact.id, `/customers/${activeCustomer.id}`);
    assertResult(payload, "vehicle", activeVehicle.id, `/vehicles/${activeVehicle.id}`);
    assertResult(payload, "vendor", activeVendor.id, `/vendors/${activeVendor.id}`);

    const excludedIds = [
      deletedCustomer.id,
      deletedVendor.id,
      deletedContact.id,
      deletedOwnerContact.id,
      deletedVehicle.id,
    ];
    for (const id of excludedIds) {
      assert.ok(!payload.results.some((result) => result.id === id), `Deleted result leaked: ${id}`);
    }

    const unauthenticatedImport = await importCoreEntities(
      new Request("http://homebase.local/api/imports/core-entities", { method: "POST" }),
    );
    await expectStatus(unauthenticatedImport, 401, "unauthenticated import stub");

    const missingCsrfImport = await importCoreEntities(
      new Request("http://homebase.local/api/imports/core-entities", {
        method: "POST",
        headers: {
          cookie: `hb_session=${session.sessionId}`,
        },
      }),
    );
    await expectStatus(missingCsrfImport, 403, "import stub without CSRF");

    const importResponse = await importCoreEntities(
      authedRequest("http://homebase.local/api/imports/core-entities", "POST", session.sessionId),
    );
    await expectStatus(importResponse, 501, "import stub");
    const importPayload = await readJson<{ error: string; deferredTo: string }>(importResponse);
    assert.equal(importPayload.deferredTo, "M11");
    assert.match(importPayload.error, /not implemented/i);

    console.log("Core search smoke test: OK");
  } finally {
    await cleanup(customerIds, vendorIds, session);
  }
}

function assertResult(
  payload: CoreSearchPayload,
  type: CoreSearchPayload["results"][number]["type"],
  id: string,
  href: string,
) {
  const result = payload.results.find((candidate) => candidate.type === type && candidate.id === id);

  assert.ok(result, `Missing ${type} result ${id}`);
  assert.equal(result.href, href);
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: authHeaders(sessionId),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "core-search-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `core-search-${label.toLowerCase()}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `core-search-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "core-search-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function cleanup(customerIds: string[], vendorIds: string[], session: TestSession) {
  if (customerIds.length > 0) {
    await db.customer.deleteMany({
      where: {
        id: { in: customerIds },
      },
    });
  }

  if (vendorIds.length > 0) {
    await db.vendor.deleteMany({
      where: {
        id: { in: vendorIds },
      },
    });
  }

  await db.session.deleteMany({
    where: { id: session.sessionId },
  });
  await db.user.deleteMany({
    where: { id: session.userId },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
