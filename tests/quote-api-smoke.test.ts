import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { POST as createQuote } from "@/app/api/quotes/route";
import {
  GET as getQuote,
  PATCH as updateQuote,
} from "@/app/api/quotes/[id]/route";
import { POST as addQuoteLine } from "@/app/api/quotes/[id]/line-items/route";
import { PATCH as updateQuoteLine } from "@/app/api/quote-line-items/[id]/route";
import { POST as sendQuote } from "@/app/api/quotes/[id]/send/route";
import { PATCH as updateQuoteStatus } from "@/app/api/quotes/[id]/status/route";
import { POST as reviseQuote } from "@/app/api/quotes/[id]/revise/route";
import { POST as applyTemplate } from "@/app/api/quotes/[id]/apply-template/route";

const csrfToken = "quote-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type QuotePayload = {
  id: string;
  quoteNumber: string;
  status: string;
  version: number;
  parentQuoteId: string | null;
  issuedAt: string | null;
  total: string | number;
  lineItems?: Array<{ id: string; lineTotal: string | number }>;
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const quoteIds: string[] = [];
  const customerIds: string[] = [];
  const productIds: string[] = [];
  const templateIds: string[] = [];

  try {
    const adminUser = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    sessions.push(adminUser);

    const customer = await db.customer.create({
      data: {
        displayName: "Quote Smoke Customer",
        email: `quote-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    const product = await db.product.create({
      data: {
        sku: `QUOTE-${suffix.slice(0, 8)}`.toUpperCase(),
        name: "Quote Smoke Part",
        defaultUnitPrice: 75,
      },
    });
    productIds.push(product.id);

    const createResponse = await createQuote(
      jsonRequest("http://homebase.local/api/quotes", "POST", adminUser.sessionId, {
        customerId: customer.id,
        notes: "Initial quote notes",
      }),
    );
    await expectStatus(createResponse, 201, "create quote");
    const createBody = await readJson<{ quote: QuotePayload }>(createResponse);
    quoteIds.push(createBody.quote.id);
    assert.match(createBody.quote.quoteNumber, /^Q-\d{6}-\d{4}$/);
    assert.equal(createBody.quote.status, "DRAFT");

    const lineResponse = await addQuoteLine(
      jsonRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}/line-items`,
        "POST",
        adminUser.sessionId,
        {
          description: "Install kit",
          quantity: 2,
          unitPrice: 45.5,
          taxable: false,
        },
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(lineResponse, 201, "add quote line");
    const lineBody = await readJson<{ lineItem: { id: string; lineTotal: string | number } }>(
      lineResponse,
    );
    assert.equal(Number(lineBody.lineItem.lineTotal), 91);

    const linePatchResponse = await updateQuoteLine(
      jsonRequest(
        `http://homebase.local/api/quote-line-items/${lineBody.lineItem.id}`,
        "PATCH",
        adminUser.sessionId,
        { quantity: 3 },
      ),
      routeContext(lineBody.lineItem.id),
    );
    await expectStatus(linePatchResponse, 200, "patch quote line partial");
    const linePatchBody = await readJson<{ lineItem: { lineTotal: string | number } }>(
      linePatchResponse,
    );
    assert.equal(Number(linePatchBody.lineItem.lineTotal), 136.5);

    const detailResponse = await getQuote(
      authedRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}`,
        "GET",
        adminUser.sessionId,
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(detailResponse, 200, "get quote detail");
    const detailBody = await readJson<{ quote: QuotePayload }>(detailResponse);
    assert.equal(Number(detailBody.quote.total), 136.5);

    const sendResponse = await sendQuote(
      authedRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}/send`,
        "POST",
        adminUser.sessionId,
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(sendResponse, 200, "send quote");
    const sendBody = await readJson<{ quote: QuotePayload }>(sendResponse);
    assert.equal(sendBody.quote.status, "SENT");
    assert.ok(sendBody.quote.issuedAt);

    const lockedQuoteUpdate = await updateQuote(
      jsonRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}`,
        "PATCH",
        adminUser.sessionId,
        { notes: "Should require a revision" },
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(lockedQuoteUpdate, 400, "locked quote cannot be patched");

    const lockedLineAdd = await addQuoteLine(
      jsonRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}/line-items`,
        "POST",
        adminUser.sessionId,
        { description: "Late line" },
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(lockedLineAdd, 400, "locked quote line add rejected");

    const acceptResponse = await updateQuoteStatus(
      jsonRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}/status`,
        "PATCH",
        adminUser.sessionId,
        { status: "ACCEPTED" },
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(acceptResponse, 200, "accept sent quote");
    const acceptBody = await readJson<{ quote: QuotePayload }>(acceptResponse);
    assert.equal(acceptBody.quote.status, "ACCEPTED");
    assert.ok(acceptBody.quote.issuedAt, "accepting should not clear issuedAt");

    const revertResponse = await updateQuoteStatus(
      jsonRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}/status`,
        "PATCH",
        adminUser.sessionId,
        { status: "DRAFT" },
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(revertResponse, 400, "terminal quote cannot reopen");

    const reviseResponse = await reviseQuote(
      authedRequest(
        `http://homebase.local/api/quotes/${createBody.quote.id}/revise`,
        "POST",
        adminUser.sessionId,
      ),
      routeContext(createBody.quote.id),
    );
    await expectStatus(reviseResponse, 201, "revise accepted quote");
    const reviseBody = await readJson<{ quote: QuotePayload }>(reviseResponse);
    quoteIds.push(reviseBody.quote.id);
    assert.equal(reviseBody.quote.status, "DRAFT");
    assert.equal(reviseBody.quote.version, 2);
    assert.equal(reviseBody.quote.parentQuoteId, createBody.quote.id);

    const clonedLineCount = await db.quoteLineItem.count({
      where: { quoteId: reviseBody.quote.id },
    });
    assert.equal(clonedLineCount, 1);

    const templateQuoteResponse = await createQuote(
      jsonRequest("http://homebase.local/api/quotes", "POST", adminUser.sessionId, {
        customerId: customer.id,
      }),
    );
    await expectStatus(templateQuoteResponse, 201, "create template target quote");
    const templateQuoteBody = await readJson<{ quote: QuotePayload }>(templateQuoteResponse);
    quoteIds.push(templateQuoteBody.quote.id);

    const template = await db.quoteTemplate.create({
      data: {
        name: `Quote smoke template ${suffix}`,
        lineItems: {
          create: {
            productId: product.id,
            sku: product.sku,
            description: "Catalog-priced line",
            quantity: 1,
            unitPrice: null,
            taxable: false,
            displayOrder: 0,
          },
        },
      },
    });
    templateIds.push(template.id);

    const applyResponse = await applyTemplate(
      jsonRequest(
        `http://homebase.local/api/quotes/${templateQuoteBody.quote.id}/apply-template`,
        "POST",
        adminUser.sessionId,
        { templateId: template.id },
      ),
      routeContext(templateQuoteBody.quote.id),
    );
    await expectStatus(applyResponse, 201, "apply template");

    const appliedLine = await db.quoteLineItem.findFirstOrThrow({
      where: { quoteId: templateQuoteBody.quote.id },
    });
    assert.equal(Number(appliedLine.unitPrice), 75);

    const appliedQuote = await db.quote.findUniqueOrThrow({
      where: { id: templateQuoteBody.quote.id },
    });
    assert.equal(Number(appliedQuote.total), 75);

    console.log("Quote API smoke test: OK");
  } finally {
    await cleanup({ sessions, quoteIds, customerIds, productIds, templateIds });
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
    "user-agent": "quote-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `quote-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `quote-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "quote-api-smoke-test",
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

async function cleanup({
  sessions,
  quoteIds,
  customerIds,
  productIds,
  templateIds,
}: {
  sessions: TestSession[];
  quoteIds: string[];
  customerIds: string[];
  productIds: string[];
  templateIds: string[];
}) {
  const entityIds = [...quoteIds, ...templateIds, ...customerIds, ...productIds];
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  }

  if (quoteIds.length > 0) {
    await db.quoteLineItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await db.quote.deleteMany({ where: { id: { in: quoteIds } } });
  }

  if (templateIds.length > 0) {
    await db.quoteTemplateLineItem.deleteMany({ where: { templateId: { in: templateIds } } });
    await db.quoteTemplate.deleteMany({ where: { id: { in: templateIds } } });
  }

  if (productIds.length > 0) {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
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
