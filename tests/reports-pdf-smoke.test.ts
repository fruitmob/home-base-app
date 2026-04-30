import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GET as exportCloseoutPdf } from "@/app/api/reports/closeout/export-pdf/route";
import { GET as exportServicePdf } from "@/app/api/reports/service/export-pdf/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { pdfFilename } from "@/lib/reports/export";
import { renderReportPdf } from "@/lib/reports/pdf";

const PDF_SIGNATURE = "%PDF-";
const csrfToken = "reports-pdf-csrf";

async function main() {
  unitTests();
  await routeTests();
  console.log("Reports PDF smoke test: OK");
}

function unitTests() {
  // Filename uses the same UTC slug layout as CSV but swaps the extension.
  assert.equal(
    pdfFilename("Service Ops", new Date("2026-04-21T08:05:00Z")),
    "homebase-service-ops-20260421-0805.pdf",
  );
  assert.equal(
    pdfFilename("no/bad|chars!?", new Date("2026-01-02T03:04:00Z")),
    "homebase-no-bad-chars--20260102-0304.pdf",
  );
}

async function routeTests() {
  const suffix = randomUUID().slice(0, 8);
  const created: { userId?: string; sessionId?: string } = {};

  try {
    // Render the shared renderer directly to prove its output is a real PDF.
    const rendered = await renderReportPdf(
      "Smoke Test Report",
      new Date("2026-04-21T12:00:00Z"),
      [
        {
          title: "Hero Metrics",
          description: "A narrow window that exercises wrapping and banding.",
          rows: [
            { label: "Active WIP", value: "12", detail: "Open + hold + QC + ready-to-bill" },
            { label: "Closed (7d)", value: "9", detail: "Work orders moved to DONE in the last week" },
          ],
        },
        {
          title: "Empty Lane",
          rows: [],
        },
      ],
    );
    const head = Buffer.from(rendered.subarray(0, 5)).toString("utf8");
    assert.equal(head, PDF_SIGNATURE, "renderer output should start with the PDF signature");
    assert.ok(rendered.byteLength > 256, "rendered PDF should have non-trivial size");

    // Service PDF route — anon is rejected.
    const anonServiceResponse = await exportServicePdf(
      new Request("http://homebase.local/api/reports/service/export-pdf", { method: "GET" }),
    );
    assert.equal(anonServiceResponse.status, 401, "unauthenticated service PDF export should 401");

    // Authenticated request returns a PDF attachment.
    const user = await db.user.create({
      data: {
        email: `reports-pdf-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.VIEWER,
      },
    });
    created.userId = user.id;

    const sessionId = `reports-pdf-smoke-${randomUUID()}`;
    await db.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "reports-pdf-smoke",
      },
    });
    created.sessionId = sessionId;

    const cookieHeader = `hb_session=${sessionId}; hb_csrf=${csrfToken}`;
    const authHeaders = {
      cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      "user-agent": "reports-pdf-smoke",
      "x-forwarded-for": "127.0.0.1",
    } as const;

    const serviceResponse = await exportServicePdf(
      new Request("http://homebase.local/api/reports/service/export-pdf", {
        method: "GET",
        headers: authHeaders,
      }),
    );
    assert.equal(serviceResponse.status, 200, "authenticated service PDF export should succeed");
    assert.match(
      serviceResponse.headers.get("content-type") ?? "",
      /application\/pdf/,
      "service PDF response should be application/pdf",
    );
    const serviceDisposition = serviceResponse.headers.get("content-disposition") ?? "";
    assert.match(
      serviceDisposition,
      /homebase-service-operations-\d{8}-\d{4}\.pdf/,
      "service PDF filename should match pattern",
    );
    const serviceBuffer = Buffer.from(await serviceResponse.arrayBuffer());
    assert.equal(
      serviceBuffer.subarray(0, 5).toString("utf8"),
      PDF_SIGNATURE,
      "service PDF body should start with the PDF signature",
    );
    assert.ok(
      serviceBuffer.byteLength > 512,
      "service PDF body should be non-trivial in size",
    );

    // Closeout PDF route — anon rejected then authed succeeds.
    const anonCloseoutResponse = await exportCloseoutPdf(
      new Request("http://homebase.local/api/reports/closeout/export-pdf", { method: "GET" }),
    );
    assert.equal(
      anonCloseoutResponse.status,
      401,
      "unauthenticated closeout PDF export should 401",
    );

    const closeoutResponse = await exportCloseoutPdf(
      new Request("http://homebase.local/api/reports/closeout/export-pdf", {
        method: "GET",
        headers: authHeaders,
      }),
    );
    assert.equal(closeoutResponse.status, 200, "authenticated closeout PDF export should succeed");
    assert.match(
      closeoutResponse.headers.get("content-type") ?? "",
      /application\/pdf/,
      "closeout PDF response should be application/pdf",
    );
    const closeoutDisposition = closeoutResponse.headers.get("content-disposition") ?? "";
    assert.match(
      closeoutDisposition,
      /homebase-financial-closeout-\d{8}-\d{4}\.pdf/,
      "closeout PDF filename should match pattern",
    );
    const closeoutBuffer = Buffer.from(await closeoutResponse.arrayBuffer());
    assert.equal(
      closeoutBuffer.subarray(0, 5).toString("utf8"),
      PDF_SIGNATURE,
      "closeout PDF body should start with the PDF signature",
    );
    assert.ok(
      closeoutBuffer.byteLength > 512,
      "closeout PDF body should be non-trivial in size",
    );
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
