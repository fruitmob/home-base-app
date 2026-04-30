import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DELETE as deleteLayout, GET as getLayout, PUT as putLayout } from "@/app/api/reports/layout/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  REPORTS_HUB_CATALOG,
  REPORTS_HUB_SCOPE,
  getDefaultReportsHubLayout,
  loadReportsHubLayout,
  saveReportsHubLayout,
} from "@/lib/reports/layout";

const csrfToken = "reports-layout-csrf";

async function main() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const ids = {
    users: [] as string[],
    sessions: [] as string[],
  };

  try {
    const ownerUser = await db.user.create({
      data: {
        email: `layout-owner-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.OWNER,
      },
    });
    const techUser = await db.user.create({
      data: {
        email: `layout-tech-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.TECH,
      },
    });
    const salesRepUser = await db.user.create({
      data: {
        email: `layout-sales-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.SALES_REP,
      },
    });
    ids.users.push(ownerUser.id, techUser.id, salesRepUser.id);

    // Role defaults: owner sees everything, tech hides sales, sales rep hides parts.
    const ownerDefault = getDefaultReportsHubLayout(Role.OWNER);
    assert.deepEqual(
      ownerDefault.order,
      REPORTS_HUB_CATALOG.map((entry) => entry.id),
      "owner default order should match catalog order",
    );
    assert.deepEqual(ownerDefault.hidden, [], "owner default should have nothing hidden");

    const techDefault = getDefaultReportsHubLayout(Role.TECH);
    assert.deepEqual(
      techDefault.hidden,
      ["sales-pipeline"],
      "tech default should hide the sales pipeline",
    );

    const salesDefault = getDefaultReportsHubLayout(Role.SALES_REP);
    assert.deepEqual(
      salesDefault.hidden,
      ["parts-inventory"],
      "sales rep default should hide parts inventory",
    );

    // When no row exists, the loader falls back to the role default.
    const ownerLoaded = await loadReportsHubLayout(ownerUser.id, Role.OWNER);
    assert.deepEqual(ownerLoaded, ownerDefault, "loader should return owner default when no row exists");

    const techLoaded = await loadReportsHubLayout(techUser.id, Role.TECH);
    assert.deepEqual(techLoaded, techDefault, "loader should return tech default when no row exists");

    // Persist a custom layout through the helper and confirm round-trip.
    const customOrder = [
      "quality-risk",
      "service-ops",
      "sales-pipeline",
      "parts-inventory",
      "financial-closeout",
    ] as const;
    const saved = await saveReportsHubLayout(ownerUser.id, {
      order: [...customOrder],
      hidden: ["financial-closeout"],
    });
    assert.deepEqual(saved.order, customOrder, "saved order should match the input order");
    assert.deepEqual(saved.hidden, ["financial-closeout"], "saved hidden list should round trip");

    const ownerReloaded = await loadReportsHubLayout(ownerUser.id, Role.OWNER);
    assert.deepEqual(ownerReloaded.order, customOrder, "reloaded order should match saved order");
    assert.deepEqual(
      ownerReloaded.hidden,
      ["financial-closeout"],
      "reloaded hidden list should match saved hidden list",
    );

    // API coverage — unauthenticated GET should fail, authenticated should succeed.
    const anonGet = await getLayout(
      new Request("http://homebase.local/api/reports/layout", { method: "GET" }),
    );
    assert.equal(anonGet.status, 401, "unauthenticated GET should return 401");

    const sessionId = `reports-layout-smoke-${randomUUID()}`;
    await db.session.create({
      data: {
        id: sessionId,
        userId: ownerUser.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "reports-layout-smoke",
      },
    });
    ids.sessions.push(sessionId);

    const cookieHeader = `hb_session=${sessionId}; hb_csrf=${csrfToken}`;

    const authedGet = await getLayout(
      new Request("http://homebase.local/api/reports/layout", {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          "user-agent": "reports-layout-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );
    assert.equal(authedGet.status, 200, "authenticated GET should return 200");
    const authedGetBody = (await authedGet.json()) as {
      layout: { order: string[]; hidden: string[] };
    };
    assert.deepEqual(authedGetBody.layout.order, customOrder, "GET should return saved order");

    // PUT without CSRF header should 403.
    const noCsrfPut = await putLayout(
      new Request("http://homebase.local/api/reports/layout", {
        method: "PUT",
        headers: {
          cookie: cookieHeader,
          "content-type": "application/json",
          "user-agent": "reports-layout-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ order: [...customOrder], hidden: [] }),
      }),
    );
    assert.equal(noCsrfPut.status, 403, "PUT without CSRF header should 403");

    // PUT with unknown widget id should 400.
    const invalidPut = await putLayout(
      new Request("http://homebase.local/api/reports/layout", {
        method: "PUT",
        headers: {
          cookie: cookieHeader,
          "x-csrf-token": csrfToken,
          "content-type": "application/json",
          "user-agent": "reports-layout-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ order: ["service-ops", "not-a-real-widget"], hidden: [] }),
      }),
    );
    assert.equal(invalidPut.status, 400, "PUT with an unknown widget id should 400");

    // PUT with a valid payload should succeed and persist.
    const newOrder = [
      "sales-pipeline",
      "service-ops",
      "parts-inventory",
      "quality-risk",
      "financial-closeout",
    ] as const;
    const validPut = await putLayout(
      new Request("http://homebase.local/api/reports/layout", {
        method: "PUT",
        headers: {
          cookie: cookieHeader,
          "x-csrf-token": csrfToken,
          "content-type": "application/json",
          "user-agent": "reports-layout-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ order: [...newOrder], hidden: ["quality-risk"] }),
      }),
    );
    assert.equal(validPut.status, 200, "PUT with a valid payload should return 200");
    const validPutBody = (await validPut.json()) as {
      layout: { order: string[]; hidden: string[] };
    };
    assert.deepEqual(validPutBody.layout.order, newOrder, "PUT response should reflect new order");
    assert.deepEqual(
      validPutBody.layout.hidden,
      ["quality-risk"],
      "PUT response should reflect new hidden list",
    );

    const afterPutRow = await db.dashboardLayout.findUnique({
      where: { userId_scope: { userId: ownerUser.id, scope: REPORTS_HUB_SCOPE } },
    });
    assert.ok(afterPutRow, "a layout row should exist after a valid PUT");

    // DELETE should clear the row and return the role default.
    const deleteResponse = await deleteLayout(
      new Request("http://homebase.local/api/reports/layout", {
        method: "DELETE",
        headers: {
          cookie: cookieHeader,
          "x-csrf-token": csrfToken,
          "user-agent": "reports-layout-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );
    assert.equal(deleteResponse.status, 200, "DELETE should return 200");
    const deleteBody = (await deleteResponse.json()) as {
      layout: { order: string[]; hidden: string[] };
    };
    assert.deepEqual(
      deleteBody.layout.hidden,
      [],
      "after DELETE, owner default has nothing hidden",
    );

    const afterDeleteRow = await db.dashboardLayout.findUnique({
      where: { userId_scope: { userId: ownerUser.id, scope: REPORTS_HUB_SCOPE } },
    });
    assert.equal(afterDeleteRow, null, "layout row should be removed after DELETE");

    console.log("Reports layout smoke test: OK");
  } finally {
    await cleanup(ids);
  }
}

async function cleanup(ids: { users: string[]; sessions: string[] }) {
  if (ids.sessions.length > 0) {
    await db.session.deleteMany({ where: { id: { in: ids.sessions } } });
  }
  if (ids.users.length > 0) {
    await db.dashboardLayout.deleteMany({ where: { userId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
