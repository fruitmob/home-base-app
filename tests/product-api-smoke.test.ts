import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DELETE as deleteProduct,
  GET as getProduct,
  PATCH as updateProduct,
} from "@/app/api/products/[id]/route";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const csrfToken = "product-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type ProductPayload = {
  product: {
    id: string;
    sku: string;
    name: string;
    family: string | null;
    active: boolean;
    defaultUnitPrice: string | number;
    taxable: boolean;
    deletedAt: string | null;
  };
};

async function main() {
  const suffix = randomUUID();
  const productIds: string[] = [];
  const sessions: TestSession[] = [];

  try {
    const partsUser = await createTestSession(Role.PARTS, `parts-${suffix}`);
    const viewerUser = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(partsUser, viewerUser);

    const unauth = await createProduct(
      jsonRequest("http://homebase.local/api/products", "POST", null, {
        sku: `SKU-${suffix}`,
        name: "Blocked",
      }),
    );
    await expectStatus(unauth, 401, "unauthenticated product create");

    const forbidden = await createProduct(
      jsonRequest("http://homebase.local/api/products", "POST", viewerUser.sessionId, {
        sku: `SKU-${suffix}`,
        name: "Blocked",
      }),
    );
    await expectStatus(forbidden, 403, "viewer product create");

    const created = await createProduct(
      jsonRequest("http://homebase.local/api/products", "POST", partsUser.sessionId, {
        sku: ` sku-${suffix} `,
        name: "Premium Brake Pad Set",
        description: "Front axle heavy-duty set.",
        family: "Brakes",
        taxable: true,
        defaultUnitPrice: "249.95",
      }),
    );
    await expectStatus(created, 201, "product create");
    const createdBody = await readJson<ProductPayload>(created);
    productIds.push(createdBody.product.id);
    assert.equal(createdBody.product.sku, `SKU-${suffix}`.toUpperCase());
    assert.equal(Number(createdBody.product.defaultUnitPrice), 249.95);
    assert.equal(createdBody.product.active, true);

    const duplicate = await createProduct(
      jsonRequest("http://homebase.local/api/products", "POST", partsUser.sessionId, {
        sku: `sku-${suffix}`,
        name: "Duplicate SKU",
        defaultUnitPrice: 10,
      }),
    );
    await expectStatus(duplicate, 409, "duplicate SKU conflict");

    const invalidPrice = await createProduct(
      jsonRequest("http://homebase.local/api/products", "POST", partsUser.sessionId, {
        sku: `SKU-OTHER-${suffix}`,
        name: "Bad Price",
        defaultUnitPrice: -1,
      }),
    );
    await expectStatus(invalidPrice, 400, "negative default unit price");

    const list = await listProducts(
      authedRequest(
        `http://homebase.local/api/products?q=${encodeURIComponent(suffix)}`,
        "GET",
        partsUser.sessionId,
      ),
    );
    await expectStatus(list, 200, "product list by query");
    const listBody = await readJson<{ products: Array<{ id: string }> }>(list);
    assert.ok(listBody.products.some((product) => product.id === createdBody.product.id));

    const familyList = await listProducts(
      authedRequest(
        `http://homebase.local/api/products?family=Brakes`,
        "GET",
        partsUser.sessionId,
      ),
    );
    await expectStatus(familyList, 200, "product list by family");
    const familyBody = await readJson<{ products: Array<{ id: string; family: string | null }> }>(
      familyList,
    );
    assert.ok(familyBody.products.every((product) => product.family === "Brakes"));

    const detail = await getProduct(
      authedRequest(
        `http://homebase.local/api/products/${createdBody.product.id}`,
        "GET",
        viewerUser.sessionId,
      ),
      routeContext(createdBody.product.id),
    );
    await expectStatus(detail, 200, "viewer read product detail");

    const patch = await updateProduct(
      jsonRequest(
        `http://homebase.local/api/products/${createdBody.product.id}`,
        "PATCH",
        partsUser.sessionId,
        { defaultUnitPrice: 259.99, active: false },
      ),
      routeContext(createdBody.product.id),
    );
    await expectStatus(patch, 200, "product update");
    const patchBody = await readJson<ProductPayload>(patch);
    assert.equal(Number(patchBody.product.defaultUnitPrice), 259.99);
    assert.equal(patchBody.product.active, false);

    const archive = await deleteProduct(
      authedRequest(
        `http://homebase.local/api/products/${createdBody.product.id}`,
        "DELETE",
        partsUser.sessionId,
      ),
      routeContext(createdBody.product.id),
    );
    await expectStatus(archive, 200, "product archive");
    const archiveBody = await readJson<ProductPayload>(archive);
    assert.ok(archiveBody.product.deletedAt);

    const afterArchive = await getProduct(
      authedRequest(
        `http://homebase.local/api/products/${createdBody.product.id}`,
        "GET",
        partsUser.sessionId,
      ),
      routeContext(createdBody.product.id),
    );
    await expectStatus(afterArchive, 404, "archived product read");

    await assertAuditRows([
      ["product.create", "Product", createdBody.product.id],
      ["product.update", "Product", createdBody.product.id],
      ["product.delete", "Product", createdBody.product.id],
    ]);

    console.log("Product API smoke test: OK");
  } finally {
    await cleanup(productIds, sessions);
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
    "user-agent": "product-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `product-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `product-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "product-api-smoke-test",
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

async function cleanup(productIds: string[], sessions: TestSession[]) {
  if (productIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: productIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
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
