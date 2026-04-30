import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { subDays } from "date-fns";
import { GET as exportPartsReport } from "@/app/api/reports/parts/export/route";
import { PartTransactionType, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getPartsInventoryReport } from "@/lib/reports/parts";

const csrfToken = "parts-report-csrf";

async function main() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const ids = {
    users: [] as string[],
    sessions: [] as string[],
    vendors: [] as string[],
    parts: [] as string[],
    partTransactions: [] as string[],
  };

  try {
    const vendor = await db.vendor.create({
      data: {
        name: `Parts Report Vendor ${suffix}`,
        vendorType: "PARTS",
      },
    });
    ids.vendors.push(vendor.id);

    const lowStockPart = await db.part.create({
      data: {
        sku: `PR-LOW-${suffix}`,
        name: `Report Low Stock Part ${suffix}`,
        vendorId: vendor.id,
        unitCost: 25,
        quantityOnHand: 1,
        quantityReserved: 0,
        reorderPoint: 5,
        active: true,
      },
    });
    const movingPart = await db.part.create({
      data: {
        sku: `PR-MOV-${suffix}`,
        name: `Report Moving Part ${suffix}`,
        vendorId: vendor.id,
        unitCost: 40,
        quantityOnHand: 20,
        quantityReserved: 2,
        reorderPoint: 0,
        active: true,
      },
    });
    const deadStockPart = await db.part.create({
      data: {
        sku: `PR-DEAD-${suffix}`,
        name: `Report Dead Stock Part ${suffix}`,
        vendorId: vendor.id,
        unitCost: 500,
        quantityOnHand: 6,
        quantityReserved: 0,
        reorderPoint: 0,
        active: true,
        createdAt: subDays(new Date(), 200),
        updatedAt: subDays(new Date(), 200),
      },
    });
    ids.parts.push(lowStockPart.id, movingPart.id, deadStockPart.id);

    const receiveTx = await db.partTransaction.create({
      data: {
        partId: lowStockPart.id,
        vendorId: vendor.id,
        type: PartTransactionType.RECEIVE,
        quantity: 10,
        unitCost: 25,
        occurredAt: subDays(new Date(), 3),
      },
    });
    const issueTx = await db.partTransaction.create({
      data: {
        partId: movingPart.id,
        type: PartTransactionType.ISSUE,
        quantity: 12,
        occurredAt: subDays(new Date(), 2),
      },
    });
    ids.partTransactions.push(receiveTx.id, issueTx.id);

    const report = await getPartsInventoryReport();

    assert.ok(
      report.lowStockRows.some((row) => row.label.includes(lowStockPart.sku)),
      "low stock rows should include the seeded low-stock part",
    );

    assert.ok(
      report.turnRows.some((row) => row.label.includes(movingPart.sku)),
      "turn rows should include the seeded moving part",
    );

    assert.ok(
      report.deadStockRows.some((row) => row.label.includes(deadStockPart.sku)),
      "dead stock rows should include the seeded dead-stock part",
    );

    assert.ok(
      report.vendorRows.some((row) => row.label === vendor.name),
      "vendor rows should include the seeded vendor",
    );

    assert.ok(
      report.windows.some((window) => /velocity/i.test(window.label)),
      "windows should include a velocity window",
    );

    const user = await db.user.create({
      data: {
        email: `parts-report-viewer-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.VIEWER,
      },
    });
    ids.users.push(user.id);

    const sessionId = `parts-report-smoke-${randomUUID()}`;
    await db.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "parts-report-smoke",
      },
    });
    ids.sessions.push(sessionId);

    const anonResponse = await exportPartsReport(
      new Request("http://homebase.local/api/reports/parts/export", { method: "GET" }),
    );
    assert.equal(anonResponse.status, 401, "unauthenticated parts export should 401");

    const authedResponse = await exportPartsReport(
      new Request("http://homebase.local/api/reports/parts/export", {
        method: "GET",
        headers: {
          cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
          "x-csrf-token": csrfToken,
          "user-agent": "parts-report-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );
    assert.equal(authedResponse.status, 200, "authenticated parts export should succeed");
    assert.match(
      authedResponse.headers.get("content-type") ?? "",
      /text\/csv/,
      "parts export response should be text/csv",
    );
    const disposition = authedResponse.headers.get("content-disposition") ?? "";
    assert.match(
      disposition,
      /homebase-parts-inventory-\d{8}-\d{4}\.csv/,
      "parts export filename should match pattern",
    );
    const body = await authedResponse.text();
    assert.ok(body.includes("Low Stock Metrics"), "body should include low stock metrics section");
    assert.ok(body.includes("Dead Stock Metrics"), "body should include dead stock metrics section");
    assert.ok(
      body.includes("Vendor Responsiveness Metrics"),
      "body should include vendor responsiveness metrics section",
    );

    console.log("Parts reports smoke test: OK");
  } finally {
    await cleanup(ids);
  }
}

async function cleanup(ids: {
  users: string[];
  sessions: string[];
  vendors: string[];
  parts: string[];
  partTransactions: string[];
}) {
  if (ids.partTransactions.length > 0) {
    await db.partTransaction.deleteMany({ where: { id: { in: ids.partTransactions } } });
  }
  if (ids.parts.length > 0) {
    await db.part.deleteMany({ where: { id: { in: ids.parts } } });
  }
  if (ids.vendors.length > 0) {
    await db.vendor.deleteMany({ where: { id: { in: ids.vendors } } });
  }
  if (ids.sessions.length > 0) {
    await db.session.deleteMany({ where: { id: { in: ids.sessions } } });
  }
  if (ids.users.length > 0) {
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
