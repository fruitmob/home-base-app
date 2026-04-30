import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as downloadQuotePdf } from "@/app/api/quotes/[id]/pdf/route";

const csrfToken = "quote-pdf-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const quoteIds: string[] = [];
  const customerIds: string[] = [];

  try {
    const adminUser = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    sessions.push(adminUser);

    const customer = await db.customer.create({
      data: {
        displayName: "PDF Smoke Customer",
        email: `quote-pdf-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    const quote = await db.quote.create({
      data: {
        quoteNumber: `PDF-${suffix}`,
        customerId: customer.id,
        status: "SENT",
        issuedAt: new Date(),
        subtotal: 125,
        taxTotal: 0,
        total: 125,
        createdByUserId: adminUser.userId,
        lineItems: {
          create: {
            description: "PDF smoke line",
            quantity: 1,
            unitPrice: 125,
            lineTotal: 125,
            taxable: false,
            displayOrder: 0,
          },
        },
      },
    });
    quoteIds.push(quote.id);

    const response = await downloadQuotePdf(
      authedRequest(
        `http://homebase.local/api/quotes/${quote.id}/pdf`,
        "GET",
        adminUser.sessionId,
      ),
      { params: { id: quote.id } },
    );

    await expectStatus(response, 200, "download quote PDF");
    assert.match(response.headers.get("content-type") ?? "", /application\/pdf/);

    const body = Buffer.from(await response.arrayBuffer());
    assert.ok(body.length > 500, "PDF should not be empty");
    assert.equal(body.subarray(0, 4).toString(), "%PDF");

    console.log("Quote PDF smoke test: OK");
  } finally {
    await cleanup({ sessions, quoteIds, customerIds });
  }
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
    "user-agent": "quote-pdf-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `quote-pdf-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `quote-pdf-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "quote-pdf-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function cleanup({
  sessions,
  quoteIds,
  customerIds,
}: {
  sessions: TestSession[];
  quoteIds: string[];
  customerIds: string[];
}) {
  const entityIds = [...quoteIds, ...customerIds];
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  }

  if (quoteIds.length > 0) {
    await db.quoteLineItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await db.quote.deleteMany({ where: { id: { in: quoteIds } } });
  }

  if (customerIds.length > 0) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
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
