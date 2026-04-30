import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { subDays } from "date-fns";
import { GET as getExceptions } from "@/app/api/admin/exceptions/route";
import { Role } from "@/generated/prisma/client";
import {
  getExceptionCounts,
  listCustomersWithoutContacts,
  listExpiredPortalTokens,
  listExpiredVideoShareLinks,
  listOpenWorkOrdersWithoutTech,
  listStaleEstimates,
  listStaleQuotes,
} from "@/lib/admin/exceptions";
import { db } from "@/lib/db";

const csrfToken = "exceptions-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const sessions: TestSession[] = [];

  const createdIds = {
    customerId: "",
    quoteId: "",
    estimateId: "",
    portalTokenId: "",
    videoId: "",
    videoShareLinkId: "",
    workOrderId: "",
  };

  try {
    const owner = await createTestSession(Role.OWNER, `exc-owner-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `exc-viewer-${suffix}`);
    sessions.push(owner, viewer);

    const staleDate = subDays(new Date(), 35);

    // Seed: customer without contacts
    const customer = await db.customer.create({
      data: {
        displayName: `Exc Smoke Co ${suffix}`,
        customerType: "BUSINESS",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    createdIds.customerId = customer.id;

    // Seed: stale quote (DRAFT, no validUntil, older than 30 days)
    const quote = await db.quote.create({
      data: {
        quoteNumber: `QSMK-${suffix}`,
        customerId: customer.id,
        status: "DRAFT",
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        createdAt: staleDate,
        updatedAt: staleDate,
      },
    });
    createdIds.quoteId = quote.id;

    // Seed: stale estimate (DRAFT, no validUntil, older than 30 days)
    const estimate = await db.estimate.create({
      data: {
        estimateNumber: `ESMK-${suffix}`,
        customerId: customer.id,
        status: "DRAFT",
        title: `Exc Smoke Estimate ${suffix}`,
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        createdAt: staleDate,
        updatedAt: staleDate,
      },
    });
    createdIds.estimateId = estimate.id;

    // Seed: expired portal token
    const portalToken = await db.portalToken.create({
      data: {
        token: `exc-smoke-tok-${suffix}`,
        customerId: customer.id,
        expiresAt: subDays(new Date(), 1),
      },
    });
    createdIds.portalTokenId = portalToken.id;

    // Seed: video + expired share link
    const video = await db.video.create({
      data: {
        cloudflareId: `exc-smoke-cf-${suffix}`,
        status: "READY",
        title: `Exc Smoke Video ${suffix}`,
        uploadedByUserId: owner.userId,
        customerId: customer.id,
      },
    });
    createdIds.videoId = video.id;

    const shareLink = await db.videoShareLink.create({
      data: {
        videoId: video.id,
        token: `exc-smoke-share-${suffix}`,
        expiresAt: subDays(new Date(), 1),
      },
    });
    createdIds.videoShareLinkId = shareLink.id;

    // Seed: open work order without tech
    const workOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WOSMK-${suffix}`,
        customerId: customer.id,
        status: "OPEN",
        priority: "NORMAL",
        title: `Exc Smoke WO ${suffix}`,
      },
    });
    createdIds.workOrderId = workOrder.id;

    // --- Direct library function tests ---

    const counts = await getExceptionCounts();
    assert.ok(counts.total >= 6, `Expected at least 6 total exceptions, got ${counts.total}`);
    assert.ok(counts.customersWithoutContacts >= 1, "Expected at least 1 customer without contacts");
    assert.ok(counts.staleQuotes >= 1, "Expected at least 1 stale quote");
    assert.ok(counts.staleEstimates >= 1, "Expected at least 1 stale estimate");
    assert.ok(counts.expiredPortalTokens >= 1, "Expected at least 1 expired portal token");
    assert.ok(counts.expiredVideoShareLinks >= 1, "Expected at least 1 expired video share link");
    assert.ok(counts.openWorkOrdersWithoutTech >= 1, "Expected at least 1 open WO without tech");

    const noContactCustomers = await listCustomersWithoutContacts();
    assert.ok(
      noContactCustomers.some((c) => c.id === customer.id),
      "Expected seeded customer in no-contact list",
    );

    const staleQuotes = await listStaleQuotes();
    assert.ok(
      staleQuotes.some((q) => q.id === quote.id),
      "Expected seeded quote in stale quote list",
    );

    const staleEstimates = await listStaleEstimates();
    assert.ok(
      staleEstimates.some((e) => e.id === estimate.id),
      "Expected seeded estimate in stale estimate list",
    );

    const expiredTokens = await listExpiredPortalTokens();
    assert.ok(
      expiredTokens.some((t) => t.id === portalToken.id),
      "Expected seeded portal token in expired list",
    );

    const expiredShareLinks = await listExpiredVideoShareLinks();
    assert.ok(
      expiredShareLinks.some((l) => l.id === shareLink.id),
      "Expected seeded share link in expired list",
    );

    const openWoNoTech = await listOpenWorkOrdersWithoutTech();
    assert.ok(
      openWoNoTech.some((wo) => wo.id === workOrder.id),
      "Expected seeded work order in open-without-tech list",
    );

    // --- API route tests ---

    const viewerSummaryResponse = await getExceptions(
      authedRequest("http://homebase.local/api/admin/exceptions?type=summary", "GET", viewer.sessionId),
    );
    assert.equal(viewerSummaryResponse.status, 403, "viewer should be blocked from exceptions");

    const summaryResponse = await getExceptions(
      authedRequest("http://homebase.local/api/admin/exceptions?type=summary", "GET", owner.sessionId),
    );
    assert.equal(summaryResponse.status, 200, "owner should get exception summary");
    const summaryBody = (await summaryResponse.json()) as {
      counts: { total: number; customersWithoutContacts: number };
    };
    assert.ok(summaryBody.counts.total >= 6, "summary total should be >= 6");

    const noContactResponse = await getExceptions(
      authedRequest(
        "http://homebase.local/api/admin/exceptions?type=customers_without_contacts",
        "GET",
        owner.sessionId,
      ),
    );
    assert.equal(noContactResponse.status, 200);
    const noContactBody = (await noContactResponse.json()) as {
      rows: Array<{ id: string }>;
    };
    assert.ok(
      noContactBody.rows.some((r) => r.id === customer.id),
      "no-contact list should include seeded customer",
    );

    const staleQuotesResponse = await getExceptions(
      authedRequest(
        "http://homebase.local/api/admin/exceptions?type=stale_quotes",
        "GET",
        owner.sessionId,
      ),
    );
    assert.equal(staleQuotesResponse.status, 200);
    const staleQuotesBody = (await staleQuotesResponse.json()) as { rows: Array<{ id: string }> };
    assert.ok(
      staleQuotesBody.rows.some((r) => r.id === quote.id),
      "stale quotes list should include seeded quote",
    );

    const badTypeResponse = await getExceptions(
      authedRequest(
        "http://homebase.local/api/admin/exceptions?type=not_a_real_type",
        "GET",
        owner.sessionId,
      ),
    );
    assert.equal(badTypeResponse.status, 400, "unknown exception type should return 400");

    console.log("Admin exceptions smoke test: OK");
  } finally {
    if (createdIds.videoShareLinkId) {
      await db.videoShareLink.deleteMany({ where: { id: createdIds.videoShareLinkId } });
    }
    if (createdIds.videoId) {
      await db.video.deleteMany({ where: { id: createdIds.videoId } });
    }
    if (createdIds.workOrderId) {
      await db.workOrder.deleteMany({ where: { id: createdIds.workOrderId } });
    }
    if (createdIds.portalTokenId) {
      await db.portalToken.deleteMany({ where: { id: createdIds.portalTokenId } });
    }
    if (createdIds.estimateId) {
      await db.estimate.deleteMany({ where: { id: createdIds.estimateId } });
    }
    if (createdIds.quoteId) {
      await db.quote.deleteMany({ where: { id: createdIds.quoteId } });
    }
    if (createdIds.customerId) {
      await db.customer.deleteMany({ where: { id: createdIds.customerId } });
    }
    if (sessions.length > 0) {
      await db.session.deleteMany({
        where: { id: { in: sessions.map((s) => s.sessionId) } },
      });
      await db.user.deleteMany({
        where: { id: { in: sessions.map((s) => s.userId) } },
      });
    }
    await db.$disconnect();
  }
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: {
      cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
      "x-csrf-token": csrfToken,
      "user-agent": "exceptions-smoke-test",
      "x-forwarded-for": "127.0.0.1",
    },
  });
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });

  const sessionId = `exc-smoke-${randomUUID()}`;
  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "exceptions-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
