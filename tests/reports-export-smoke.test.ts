import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GET as exportSalesReport } from "@/app/api/reports/sales/export/route";
import { GET as exportServiceReport } from "@/app/api/reports/service/export/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  csvFilename,
  dashboardItemsToRows,
  formatCsvCell,
  rowsToCsv,
  sectionsToCsv,
} from "@/lib/reports/export";

const csrfToken = "reports-export-csrf";

async function main() {
  unitTests();
  await routeTests();
  console.log("Reports export smoke test: OK");
}

function unitTests() {
  // Null and undefined collapse to empty cell.
  assert.equal(formatCsvCell(null), "");
  assert.equal(formatCsvCell(undefined), "");

  // RFC 4180: fields containing commas, quotes, or newlines must be quoted.
  assert.equal(formatCsvCell("simple"), "simple");
  assert.equal(formatCsvCell("has,comma"), '"has,comma"');
  assert.equal(formatCsvCell('has "quote"'), '"has ""quote"""');
  assert.equal(formatCsvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(formatCsvCell("line1\r\nline2"), '"line1\r\nline2"');

  // Numbers stringify without locale formatting; non-finite collapses to empty.
  assert.equal(formatCsvCell(42), "42");
  assert.equal(formatCsvCell(1.25), "1.25");
  assert.equal(formatCsvCell(Number.NaN), "");
  assert.equal(formatCsvCell(Number.POSITIVE_INFINITY), "");

  // Dates serialize as ISO-8601.
  const date = new Date("2026-04-21T15:30:00Z");
  assert.equal(formatCsvCell(date), "2026-04-21T15:30:00.000Z");

  // Booleans serialize as lowercase strings.
  assert.equal(formatCsvCell(true), "true");
  assert.equal(formatCsvCell(false), "false");

  // Generic rowsToCsv produces header + body rows with CRLF line endings.
  const generic = rowsToCsv(
    [
      { sku: "A-1", qty: 3, note: "has,comma" },
      { sku: "B-2", qty: 5, note: null },
    ],
    [
      { header: "SKU", value: (r) => r.sku },
      { header: "Qty", value: (r) => r.qty },
      { header: "Note", value: (r) => r.note },
    ],
  );
  assert.ok(generic.startsWith("SKU,Qty,Note\r\n"), "header row should be first");
  assert.ok(generic.includes('A-1,3,"has,comma"'), "row with comma should be quoted");
  assert.ok(generic.includes("B-2,5,\r\n"), "null cell should render empty");

  // sectionsToCsv includes report title, generated timestamp, and section rows.
  const sectioned = sectionsToCsv("Test Report", date, [
    {
      title: "Metrics",
      rows: [
        { label: "Open WO", value: "12", detail: "all statuses" },
        { label: "Held", value: "3" },
      ],
    },
    {
      title: "Empty Section",
      rows: [],
    },
  ]);
  assert.ok(sectioned.includes("Report,Test Report"), "should include report title");
  assert.ok(sectioned.includes("Generated,2026-04-21T15:30:00.000Z"), "should include ISO timestamp");
  assert.ok(sectioned.includes("Metrics"), "should include section title");
  assert.ok(sectioned.includes("Label,Value,Detail"), "should include section header row");
  assert.ok(sectioned.includes("Open WO,12,all statuses"), "should include first row");
  assert.ok(sectioned.includes("Held,3,"), "row without detail should still emit empty detail column");
  assert.ok(sectioned.includes("(no rows)"), "empty section should emit placeholder");

  // Filename is UTC-stamped and slug-safe.
  const name = csvFilename("Service Ops", new Date("2026-04-21T08:05:00Z"));
  assert.equal(name, "homebase-service-ops-20260421-0805.csv");
  assert.equal(
    csvFilename("no/bad|chars!?", new Date("2026-01-02T03:04:00Z")),
    "homebase-no-bad-chars--20260102-0304.csv",
  );

  // dashboardItemsToRows preserves label/value/detail.
  const mapped = dashboardItemsToRows([
    { label: "A", value: "1", detail: "d" },
    { label: "B", value: "2", detail: "" },
  ]);
  assert.deepEqual(mapped, [
    { label: "A", value: "1", detail: "d" },
    { label: "B", value: "2", detail: "" },
  ]);
}

async function routeTests() {
  const suffix = randomUUID().slice(0, 8);
  const created: { userId?: string; sessionId?: string } = {};

  try {
    // Unauthenticated request should be rejected.
    const anonResponse = await exportServiceReport(
      new Request("http://homebase.local/api/reports/service/export", { method: "GET" }),
    );
    assert.equal(anonResponse.status, 401, "unauthenticated export should 401");

    // Authenticated request returns a well-formed CSV attachment.
    const user = await db.user.create({
      data: {
        email: `reports-export-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.VIEWER,
      },
    });
    created.userId = user.id;

    const sessionId = `reports-export-smoke-${randomUUID()}`;
    await db.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "reports-export-smoke",
      },
    });
    created.sessionId = sessionId;

    const authedResponse = await exportServiceReport(
      new Request("http://homebase.local/api/reports/service/export", {
        method: "GET",
        headers: {
          cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
          "x-csrf-token": csrfToken,
          "user-agent": "reports-export-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );
    assert.equal(authedResponse.status, 200, "authenticated export should succeed");
    assert.match(
      authedResponse.headers.get("content-type") ?? "",
      /text\/csv/,
      "response should be text/csv",
    );
    const disposition = authedResponse.headers.get("content-disposition") ?? "";
    assert.match(disposition, /attachment/i, "response should be an attachment");
    assert.match(disposition, /homebase-service-operations-\d{8}-\d{4}\.csv/, "filename should match pattern");

    const body = await authedResponse.text();
    assert.ok(body.startsWith("Report,Service Operations Report"), "body should start with report title row");
    assert.ok(body.includes("Hero Metrics"), "body should include hero metrics section");
    assert.ok(body.includes("WIP Metrics"), "body should include wip metrics section");
    assert.ok(body.includes("Label,Value,Detail"), "body should include section header rows");

    // Sales export — reuses the same session so role scoping logic gets exercised.
    const salesAnonResponse = await exportSalesReport(
      new Request("http://homebase.local/api/reports/sales/export", { method: "GET" }),
    );
    assert.equal(salesAnonResponse.status, 401, "unauthenticated sales export should 401");

    const salesResponse = await exportSalesReport(
      new Request("http://homebase.local/api/reports/sales/export", {
        method: "GET",
        headers: {
          cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
          "x-csrf-token": csrfToken,
          "user-agent": "reports-export-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );
    assert.equal(salesResponse.status, 200, "authenticated sales export should succeed");
    assert.match(
      salesResponse.headers.get("content-type") ?? "",
      /text\/csv/,
      "sales response should be text/csv",
    );
    const salesDisposition = salesResponse.headers.get("content-disposition") ?? "";
    assert.match(salesDisposition, /homebase-sales-performance-\d{8}-\d{4}\.csv/, "sales filename should match pattern");
    const salesBody = await salesResponse.text();
    assert.ok(salesBody.includes("Pipeline Metrics"), "sales body should include pipeline metrics section");
    assert.ok(salesBody.includes("Customer Metrics"), "sales body should include customer metrics section");
  } finally {
    if (created.sessionId) {
      await db.session.deleteMany({ where: { id: created.sessionId } });
    }
    if (created.userId) {
      await db.user.deleteMany({ where: { id: created.userId } });
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
