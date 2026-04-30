import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DELETE as deleteEntry,
  PATCH as updateEntry,
} from "@/app/api/pricebook-entries/[id]/route";
import {
  DELETE as deletePricebook,
  GET as getPricebook,
  PATCH as updatePricebook,
} from "@/app/api/pricebooks/[id]/route";
import {
  GET as listEntries,
  POST as createEntry,
} from "@/app/api/pricebooks/[id]/entries/route";
import { GET as listPricebooks, POST as createPricebook } from "@/app/api/pricebooks/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resolvePrice } from "@/lib/sales/pricing";

const csrfToken = "pricebook-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type PricebookPayload = {
  pricebook: {
    id: string;
    name: string;
    isDefault: boolean;
    active: boolean;
    deletedAt: string | null;
  };
};

type EntryPayload = {
  entry: {
    id: string;
    productId: string;
    unitPrice: string | number;
    deletedAt: string | null;
  };
};

async function main() {
  const suffix = randomUUID();
  const pricebookIds: string[] = [];
  const productIds: string[] = [];
  const customerIds: string[] = [];
  const entryIds: string[] = [];
  const sessions: TestSession[] = [];
  const existingDefaults = await db.pricebook.findMany({
    where: { isDefault: true, deletedAt: null },
    select: { id: true },
  });

  try {
    const partsUser = await createTestSession(Role.PARTS, `parts-${suffix}`);
    const salesUser = await createTestSession(Role.SALES_REP, `sales-${suffix}`);
    sessions.push(partsUser, salesUser);

    const productA = await db.product.create({
      data: {
        sku: `PB-A-${suffix}`,
        name: "Cabin Filter",
        defaultUnitPrice: "24.00",
      },
    });
    const productB = await db.product.create({
      data: {
        sku: `PB-B-${suffix}`,
        name: "Oil Filter",
        defaultUnitPrice: "14.50",
      },
    });
    productIds.push(productA.id, productB.id);

    const blocked = await createPricebook(
      jsonRequest("http://homebase.local/api/pricebooks", "POST", salesUser.sessionId, {
        name: `Sales Blocked ${suffix}`,
      }),
    );
    await expectStatus(blocked, 403, "sales pricebook create");

    const defaultCreate = await createPricebook(
      jsonRequest("http://homebase.local/api/pricebooks", "POST", partsUser.sessionId, {
        name: `Shop Default ${suffix}`,
        isDefault: true,
      }),
    );
    await expectStatus(defaultCreate, 201, "default pricebook create");
    const defaultBody = await readJson<PricebookPayload>(defaultCreate);
    pricebookIds.push(defaultBody.pricebook.id);
    assert.equal(defaultBody.pricebook.isDefault, true);

    for (const prior of existingDefaults) {
      if (prior.id === defaultBody.pricebook.id) {
        continue;
      }

      const still = await db.pricebook.findUnique({ where: { id: prior.id } });
      assert.equal(still?.isDefault, false, "prior default should flip off");
    }

    const fleetCreate = await createPricebook(
      jsonRequest("http://homebase.local/api/pricebooks", "POST", partsUser.sessionId, {
        name: `Fleet Tier ${suffix}`,
      }),
    );
    await expectStatus(fleetCreate, 201, "fleet pricebook create");
    const fleetBody = await readJson<PricebookPayload>(fleetCreate);
    pricebookIds.push(fleetBody.pricebook.id);
    assert.equal(fleetBody.pricebook.isDefault, false);

    const promote = await updatePricebook(
      jsonRequest(
        `http://homebase.local/api/pricebooks/${fleetBody.pricebook.id}`,
        "PATCH",
        partsUser.sessionId,
        { isDefault: true },
      ),
      routeContext(fleetBody.pricebook.id),
    );
    await expectStatus(promote, 200, "fleet pricebook promote");
    const promotedBody = await readJson<PricebookPayload>(promote);
    assert.equal(promotedBody.pricebook.isDefault, true);

    const demotedDefault = await db.pricebook.findUnique({
      where: { id: defaultBody.pricebook.id },
    });
    assert.equal(demotedDefault?.isDefault, false, "prior default should have been demoted");

    const defaultDelete = await deletePricebook(
      authedRequest(
        `http://homebase.local/api/pricebooks/${fleetBody.pricebook.id}`,
        "DELETE",
        partsUser.sessionId,
      ),
      routeContext(fleetBody.pricebook.id),
    );
    await expectStatus(defaultDelete, 409, "cannot delete default pricebook");

    await updatePricebook(
      jsonRequest(
        `http://homebase.local/api/pricebooks/${defaultBody.pricebook.id}`,
        "PATCH",
        partsUser.sessionId,
        { isDefault: true },
      ),
      routeContext(defaultBody.pricebook.id),
    );

    const nonDefaultDelete = await deletePricebook(
      authedRequest(
        `http://homebase.local/api/pricebooks/${fleetBody.pricebook.id}`,
        "DELETE",
        partsUser.sessionId,
      ),
      routeContext(fleetBody.pricebook.id),
    );
    await expectStatus(nonDefaultDelete, 200, "non-default pricebook archive");

    const recreate = await createPricebook(
      jsonRequest("http://homebase.local/api/pricebooks", "POST", partsUser.sessionId, {
        name: `Fleet Tier ${suffix} 2`,
      }),
    );
    await expectStatus(recreate, 201, "second fleet pricebook create");
    const recreateBody = await readJson<PricebookPayload>(recreate);
    pricebookIds.push(recreateBody.pricebook.id);

    const entry = await createEntry(
      jsonRequest(
        `http://homebase.local/api/pricebooks/${recreateBody.pricebook.id}/entries`,
        "POST",
        partsUser.sessionId,
        { productId: productA.id, unitPrice: "19.95" },
      ),
      routeContext(recreateBody.pricebook.id),
    );
    await expectStatus(entry, 201, "pricebook entry create");
    const entryBody = await readJson<EntryPayload>(entry);
    entryIds.push(entryBody.entry.id);
    assert.equal(Number(entryBody.entry.unitPrice), 19.95);

    const duplicate = await createEntry(
      jsonRequest(
        `http://homebase.local/api/pricebooks/${recreateBody.pricebook.id}/entries`,
        "POST",
        partsUser.sessionId,
        { productId: productA.id, unitPrice: "18" },
      ),
      routeContext(recreateBody.pricebook.id),
    );
    await expectStatus(duplicate, 409, "duplicate product entry");

    const entriesList = await listEntries(
      authedRequest(
        `http://homebase.local/api/pricebooks/${recreateBody.pricebook.id}/entries`,
        "GET",
        partsUser.sessionId,
      ),
      routeContext(recreateBody.pricebook.id),
    );
    await expectStatus(entriesList, 200, "pricebook entry list");
    const entriesBody = await readJson<{ entries: Array<{ id: string }> }>(entriesList);
    assert.ok(entriesBody.entries.some((row) => row.id === entryBody.entry.id));

    const customer = await db.customer.create({
      data: {
        customerType: "BUSINESS",
        displayName: `Pricebook Smoke ${suffix}`,
        companyName: `Pricebook Smoke ${suffix}`,
        defaultPricebookId: recreateBody.pricebook.id,
      },
    });
    customerIds.push(customer.id);

    const resolvedViaCustomer = await resolvePrice(productA.id, { customerId: customer.id });
    assert.equal(resolvedViaCustomer.unitPrice, 19.95);
    assert.equal(resolvedViaCustomer.source, "pricebook_entry");
    assert.equal(resolvedViaCustomer.pricebookId, recreateBody.pricebook.id);

    const resolvedFallback = await resolvePrice(productB.id, { customerId: customer.id });
    assert.equal(resolvedFallback.source, "product_default");
    assert.equal(resolvedFallback.unitPrice, 14.5);

    const resolvedDefaultBook = await resolvePrice(productA.id);
    assert.equal(resolvedDefaultBook.pricebookId, defaultBody.pricebook.id);
    assert.equal(resolvedDefaultBook.source, "product_default");

    const updateEntryResponse = await updateEntry(
      jsonRequest(
        `http://homebase.local/api/pricebook-entries/${entryBody.entry.id}`,
        "PATCH",
        partsUser.sessionId,
        { unitPrice: 17.5 },
      ),
      routeContext(entryBody.entry.id),
    );
    await expectStatus(updateEntryResponse, 200, "pricebook entry update");
    const updatedEntry = await readJson<EntryPayload>(updateEntryResponse);
    assert.equal(Number(updatedEntry.entry.unitPrice), 17.5);

    const deleteEntryResponse = await deleteEntry(
      authedRequest(
        `http://homebase.local/api/pricebook-entries/${entryBody.entry.id}`,
        "DELETE",
        partsUser.sessionId,
      ),
      routeContext(entryBody.entry.id),
    );
    await expectStatus(deleteEntryResponse, 200, "pricebook entry delete");

    const listAfterDelete = await listEntries(
      authedRequest(
        `http://homebase.local/api/pricebooks/${recreateBody.pricebook.id}/entries`,
        "GET",
        partsUser.sessionId,
      ),
      routeContext(recreateBody.pricebook.id),
    );
    await expectStatus(listAfterDelete, 200, "pricebook entry list after delete");
    const afterDeleteBody = await readJson<{ entries: Array<{ id: string }> }>(listAfterDelete);
    assert.ok(!afterDeleteBody.entries.some((row) => row.id === entryBody.entry.id));

    const detail = await getPricebook(
      authedRequest(
        `http://homebase.local/api/pricebooks/${recreateBody.pricebook.id}`,
        "GET",
        partsUser.sessionId,
      ),
      routeContext(recreateBody.pricebook.id),
    );
    await expectStatus(detail, 200, "pricebook detail");

    const listPricebooksResponse = await listPricebooks(
      authedRequest("http://homebase.local/api/pricebooks?active=true", "GET", partsUser.sessionId),
    );
    await expectStatus(listPricebooksResponse, 200, "pricebook list");
    const pricebookList = await readJson<{ pricebooks: Array<{ id: string; active: boolean }> }>(
      listPricebooksResponse,
    );
    assert.ok(pricebookList.pricebooks.every((row) => row.active === true));

    const countDefaults = await db.pricebook.count({
      where: { isDefault: true, deletedAt: null },
    });
    assert.equal(countDefaults, 1, "exactly one default pricebook expected");

    await assertAuditRows([
      ["pricebook.create", "Pricebook", defaultBody.pricebook.id],
      ["pricebook.update", "Pricebook", fleetBody.pricebook.id],
      ["pricebook.delete", "Pricebook", fleetBody.pricebook.id],
      ["pricebook_entry.create", "PricebookEntry", entryBody.entry.id],
      ["pricebook_entry.update", "PricebookEntry", entryBody.entry.id],
      ["pricebook_entry.delete", "PricebookEntry", entryBody.entry.id],
    ]);

    console.log("Pricebook API smoke test: OK");
  } finally {
    await cleanup({
      pricebookIds,
      productIds,
      customerIds,
      entryIds,
      sessions,
      restoreDefaults: existingDefaults.map((row) => row.id),
    });
  }
}

function routeContext(id: string) {
  return { params: { id } };
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: authHeaders(sessionId),
  });
}

function jsonRequest(url: string, method: string, sessionId: string | null, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      ...(sessionId ? authHeaders(sessionId) : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "pricebook-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `pricebook-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `pricebook-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "pricebook-api-smoke-test",
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

async function assertAuditRows(rows: Array<[string, string, string]>) {
  for (const [action, entityType, entityId] of rows) {
    const auditRow = await db.auditLog.findFirst({
      where: { action, entityType, entityId },
    });

    assert.ok(auditRow, `Missing audit row for ${action} ${entityId}`);
  }
}

async function cleanup(state: {
  pricebookIds: string[];
  productIds: string[];
  customerIds: string[];
  entryIds: string[];
  sessions: TestSession[];
  restoreDefaults: string[];
}) {
  const { pricebookIds, productIds, customerIds, entryIds, sessions, restoreDefaults } = state;
  const auditIds = [...pricebookIds, ...productIds, ...entryIds];

  if (auditIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: auditIds } } });
  }

  if (entryIds.length > 0) {
    await db.pricebookEntry.deleteMany({ where: { id: { in: entryIds } } });
  }

  if (customerIds.length > 0) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  if (pricebookIds.length > 0) {
    await db.pricebookEntry.deleteMany({ where: { pricebookId: { in: pricebookIds } } });
    await db.pricebook.deleteMany({ where: { id: { in: pricebookIds } } });
  }

  if (productIds.length > 0) {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
  }

  if (restoreDefaults.length > 0) {
    await db.pricebook.updateMany({
      where: { id: { in: restoreDefaults } },
      data: { isDefault: true },
    });
  }

  if (sessions.length > 0) {
    await db.session.deleteMany({
      where: { id: { in: sessions.map((session) => session.sessionId) } },
    });
    await db.user.deleteMany({
      where: { id: { in: sessions.map((session) => session.userId) } },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
