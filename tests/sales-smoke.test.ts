import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { POST as createLead } from "@/app/api/leads/route";
import { POST as convertLead } from "@/app/api/leads/[id]/convert/route";
import { POST as createQuote } from "@/app/api/quotes/route";
import { POST as applyTemplate } from "@/app/api/quotes/[id]/apply-template/route";
import { POST as sendQuote } from "@/app/api/quotes/[id]/send/route";
import { PATCH as updateQuoteStatus } from "@/app/api/quotes/[id]/status/route";
import { POST as createActivity } from "@/app/api/activities/route";
import { POST as createCase } from "@/app/api/cases/route";
import { DELETE as deleteOpportunity, GET as listOpportunities } from "@/app/api/opportunities/[id]/route";
import { GET as searchSales } from "@/app/api/search/sales/route";

const csrfToken = "sales-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const token = `M03SMOKE${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const sessions: TestSession[] = [];
  const leadIds: string[] = [];
  const customerIds: string[] = [];
  const opportunityIds: string[] = [];
  const quoteIds: string[] = [];
  const templateIds: string[] = [];
  const productIds: string[] = [];
  const caseIds: string[] = [];
  const activityIds: string[] = [];

  try {
    const salesRep = await createTestSession(Role.SALES_REP, `rep-${token}`);
    sessions.push(salesRep);

    const leadResponse = await createLead(
      jsonRequest("http://homebase.local/api/leads", "POST", salesRep.sessionId, {
        displayName: `${token} Lead`,
        companyName: `${token} Fleet Co`,
        email: `${token.toLowerCase()}@lead.example.test`,
        status: "WORKING",
        source: "WEB",
        interest: `${token} inspection bundle`,
        estimatedValue: 7200,
        ownerUserId: salesRep.userId,
      }),
    );
    await expectStatus(leadResponse, 201, "create lead");
    const leadBody = await readJson<{ lead: { id: string } }>(leadResponse);
    leadIds.push(leadBody.lead.id);

    const convertResponse = await convertLead(
      jsonRequest(
        `http://homebase.local/api/leads/${leadBody.lead.id}/convert`,
        "POST",
        salesRep.sessionId,
        {
          createCustomer: true,
          opportunityName: `${token} Opportunity`,
          opportunityAmount: 7200,
          opportunityOwnerUserId: salesRep.userId,
          opportunityNotes: `${token} converted opportunity notes`,
        },
      ),
      routeContext(leadBody.lead.id),
    );
    await expectStatus(convertResponse, 200, "convert lead");
    const convertBody = await readJson<{
      lead: { id: string };
      opportunity: { id: string; customerId: string };
    }>(convertResponse);
    opportunityIds.push(convertBody.opportunity.id);
    customerIds.push(convertBody.opportunity.customerId);

    const product = await db.product.create({
      data: {
        sku: `${token}-PKG`,
        name: `${token} Inspection Package`,
        defaultUnitPrice: 720,
        taxable: false,
      },
    });
    productIds.push(product.id);

    const template = await db.quoteTemplate.create({
      data: {
        name: `${token} Template`,
        lineItems: {
          create: {
            productId: product.id,
            sku: product.sku,
            description: product.name,
            quantity: 2,
            unitPrice: null,
            taxable: false,
            displayOrder: 0,
          },
        },
      },
    });
    templateIds.push(template.id);

    const quoteResponse = await createQuote(
      jsonRequest("http://homebase.local/api/quotes", "POST", salesRep.sessionId, {
        customerId: convertBody.opportunity.customerId,
        opportunityId: convertBody.opportunity.id,
        notes: `${token} draft quote`,
      }),
    );
    await expectStatus(quoteResponse, 201, "create quote");
    const quoteBody = await readJson<{ quote: { id: string } }>(quoteResponse);
    quoteIds.push(quoteBody.quote.id);

    const applyTemplateResponse = await applyTemplate(
      jsonRequest(
        `http://homebase.local/api/quotes/${quoteBody.quote.id}/apply-template`,
        "POST",
        salesRep.sessionId,
        { templateId: template.id },
      ),
      routeContext(quoteBody.quote.id),
    );
    await expectStatus(applyTemplateResponse, 201, "apply quote template");

    const quoteWithLine = await db.quote.findUniqueOrThrow({
      where: { id: quoteBody.quote.id },
      include: { lineItems: true },
    });
    assert.equal(quoteWithLine.lineItems.length, 1);
    assert.equal(Number(quoteWithLine.total), 1440);

    const sendResponse = await sendQuote(
      authedRequest(
        `http://homebase.local/api/quotes/${quoteBody.quote.id}/send`,
        "POST",
        salesRep.sessionId,
      ),
      routeContext(quoteBody.quote.id),
    );
    await expectStatus(sendResponse, 200, "send quote");

    const acceptResponse = await updateQuoteStatus(
      jsonRequest(
        `http://homebase.local/api/quotes/${quoteBody.quote.id}/status`,
        "PATCH",
        salesRep.sessionId,
        { status: "ACCEPTED" },
      ),
      routeContext(quoteBody.quote.id),
    );
    await expectStatus(acceptResponse, 200, "accept quote");

    const activityResponse = await createActivity(
      jsonRequest("http://homebase.local/api/activities", "POST", salesRep.sessionId, {
        opportunityId: convertBody.opportunity.id,
        type: "NOTE",
        subject: `${token} acceptance note`,
        body: "Customer accepted the quote.",
      }),
    );
    await expectStatus(activityResponse, 201, "log activity");
    const activityBody = await readJson<{ id: string }>(activityResponse);
    activityIds.push(activityBody.id);

    const caseResponse = await createCase(
      jsonRequest("http://homebase.local/api/cases", "POST", salesRep.sessionId, {
        customerId: convertBody.opportunity.customerId,
        assignedUserId: salesRep.userId,
        priority: "NORMAL",
        subject: `${token} onboarding follow-up`,
        description: "Coordinate first service appointment after quote acceptance.",
      }),
    );
    await expectStatus(caseResponse, 201, "open case");
    const caseBody = await readJson<{ case: { id: string } }>(caseResponse);
    caseIds.push(caseBody.case.id);

    const preDeleteSearchResponse = await searchSales(
      authedRequest(
        `http://homebase.local/api/search/sales?q=${encodeURIComponent(token)}`,
        "GET",
        salesRep.sessionId,
      ),
    );
    await expectStatus(preDeleteSearchResponse, 200, "search sales before delete");
    const preDeleteSearch = await readJson<SearchPayload>(preDeleteSearchResponse);
    assert.ok(
      preDeleteSearch.results.some(
        (result) => result.type === "opportunity" && result.id === convertBody.opportunity.id,
      ),
      "opportunity should be visible before soft delete",
    );

    const deleteResponse = await deleteOpportunity(
      authedRequest(
        `http://homebase.local/api/opportunities/${convertBody.opportunity.id}`,
        "DELETE",
        salesRep.sessionId,
      ),
      routeContext(convertBody.opportunity.id),
    );
    await expectStatus(deleteResponse, 204, "soft-delete opportunity");

    const getDeletedOpportunity = await listOpportunities(
      authedRequest(
        `http://homebase.local/api/opportunities/${convertBody.opportunity.id}`,
        "GET",
        salesRep.sessionId,
      ),
      routeContext(convertBody.opportunity.id),
    );
    await expectStatus(getDeletedOpportunity, 404, "deleted opportunity hidden from detail");

    const postDeleteSearchResponse = await searchSales(
      authedRequest(
        `http://homebase.local/api/search/sales?q=${encodeURIComponent(token)}`,
        "GET",
        salesRep.sessionId,
      ),
    );
    await expectStatus(postDeleteSearchResponse, 200, "search sales after delete");
    const postDeleteSearch = await readJson<SearchPayload>(postDeleteSearchResponse);
    assert.ok(
      !postDeleteSearch.results.some(
        (result) => result.type === "opportunity" && result.id === convertBody.opportunity.id,
      ),
      "soft-deleted opportunity should not appear in search",
    );

    console.log("Sales closeout smoke test: OK");
  } finally {
    await cleanup({
      sessions,
      leadIds,
      customerIds,
      opportunityIds,
      quoteIds,
      templateIds,
      productIds,
      caseIds,
      activityIds,
    });
  }
}

type SearchPayload = {
  results: Array<{
    type: string;
    id: string;
  }>;
};

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
    "user-agent": "sales-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `sales-smoke-${label.toLowerCase()}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `sales-smoke-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "sales-smoke-test",
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
  leadIds,
  customerIds,
  opportunityIds,
  quoteIds,
  templateIds,
  productIds,
  caseIds,
  activityIds,
}: {
  sessions: TestSession[];
  leadIds: string[];
  customerIds: string[];
  opportunityIds: string[];
  quoteIds: string[];
  templateIds: string[];
  productIds: string[];
  caseIds: string[];
  activityIds: string[];
}) {
  const entityIds = [
    ...leadIds,
    ...customerIds,
    ...opportunityIds,
    ...quoteIds,
    ...templateIds,
    ...productIds,
    ...caseIds,
    ...activityIds,
  ];

  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  }

  if (activityIds.length > 0) {
    await db.activity.deleteMany({ where: { id: { in: activityIds } } });
  }

  if (caseIds.length > 0) {
    await db.case.deleteMany({ where: { id: { in: caseIds } } });
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

  if (leadIds.length > 0) {
    await db.lead.deleteMany({ where: { id: { in: leadIds } } });
  }

  if (opportunityIds.length > 0) {
    await db.opportunity.deleteMany({ where: { id: { in: opportunityIds } } });
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
