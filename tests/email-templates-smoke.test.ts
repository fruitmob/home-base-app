import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EmailSendStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ensureEmailTemplatesSeeded, EMAIL_TEMPLATE_SEEDS } from "@/lib/email/seed";
import {
  TemplatedEmailError,
  renderTemplate,
  sendTemplatedEmail,
} from "@/lib/email/templates";
import { sendPortalLinkToCustomer } from "@/lib/shop/portal";

async function main() {
  unitTests();
  await seedTests();
  await renderAndSendTests();
  await portalMigrationTest();
  console.log("Email templates smoke test: OK");
}

function unitTests() {
  const template = {
    key: "ut.test",
    version: 3,
    subject: "Hello {{customerName}}",
    html: "<p>Hi {{customerName}}, visit {{portalUrl}}</p>",
    text: "Hi {{customerName}}, visit {{portalUrl}}",
    variablesJson: ["customerName", "portalUrl"],
  };

  const rendered = renderTemplate(template, {
    customerName: "Ada & Co.",
    portalUrl: "https://example.test/portal/abc",
  });

  assert.equal(rendered.subject, "Hello Ada & Co.", "subject should interpolate without HTML escaping");
  assert.ok(
    rendered.html.includes("Ada &amp; Co."),
    "html should HTML-escape interpolated values",
  );
  assert.ok(rendered.text.includes("Ada & Co."), "text should keep raw values");

  assert.throws(
    () =>
      renderTemplate(template, {
        customerName: "Ada",
      }),
    (error: unknown) =>
      error instanceof TemplatedEmailError && error.code === "MISSING_VARIABLE",
    "missing required variable should raise MISSING_VARIABLE",
  );

  // Unknown placeholders in the template body remain as-is (forgiving output).
  const rendered2 = renderTemplate(
    { ...template, html: "<p>{{unknown}}</p>" },
    { customerName: "Ada", portalUrl: "x" },
  );
  assert.equal(rendered2.html, "<p>{{unknown}}</p>", "unknown placeholders should remain literal");
}

async function seedTests() {
  const first = await ensureEmailTemplatesSeeded();
  assert.equal(first.length, EMAIL_TEMPLATE_SEEDS.length, "seeder should touch every seed entry");
  for (const entry of first) {
    assert.ok(
      entry.action === "created" || entry.action === "unchanged" || entry.action === "updated",
      `seeder entry should report a valid action (got ${entry.action})`,
    );
  }

  const second = await ensureEmailTemplatesSeeded();
  for (const entry of second) {
    assert.notEqual(
      entry.action,
      "created",
      `running the seeder twice should not recreate ${entry.key}`,
    );
  }

  for (const seed of EMAIL_TEMPLATE_SEEDS) {
    const template = await db.emailTemplate.findUnique({ where: { key: seed.key } });
    assert.ok(template, `template ${seed.key} should exist after seeding`);
    assert.equal(template?.subject, seed.subject, "persisted subject should match seed");
  }
}

async function renderAndSendTests() {
  const suffix = randomUUID().slice(0, 8);
  const recipient = `templates-smoke-${suffix}@example.test`;

  // TEMPLATE_NOT_FOUND on a missing key.
  await assert.rejects(
    sendTemplatedEmail({
      templateKey: "does.not.exist",
      to: recipient,
      variables: {},
    }),
    (error: unknown) =>
      error instanceof TemplatedEmailError && error.code === "TEMPLATE_NOT_FOUND",
    "unknown template key should raise TEMPLATE_NOT_FOUND",
  );

  // Successful send records a row.
  const result = await sendTemplatedEmail({
    templateKey: "portal.magic-link",
    to: recipient,
    variables: {
      customerName: "Smoke & Mirrors",
      portalUrl: "https://example.test/portal/smoke",
      expirationDays: 7,
    },
  });

  assert.ok(result.send.id, "send should return a persisted id");
  assert.ok(
    result.rendered.subject.startsWith("Your Home Base portal link"),
    "rendered subject should match template",
  );
  assert.ok(
    result.send.status === EmailSendStatus.SENT || result.send.status === EmailSendStatus.SIMULATED,
    `send status should be SENT or SIMULATED (got ${result.send.status})`,
  );

  const persisted = await db.emailSend.findUnique({ where: { id: result.send.id } });
  assert.ok(persisted, "the EmailSend row should exist in the database");
  assert.equal(persisted?.recipientEmail, recipient, "recipient should round trip");
  assert.equal(persisted?.templateKey, "portal.magic-link", "templateKey should round trip");
  assert.equal(
    persisted?.templateVersion,
    result.rendered.version,
    "persisted templateVersion should match the rendered version",
  );
  assert.ok(
    result.rendered.html.includes("Smoke &amp; Mirrors"),
    "rendered html should HTML-escape ampersand in the customer name",
  );
  assert.ok(
    result.rendered.text.includes("Smoke & Mirrors"),
    "rendered text should keep the raw ampersand",
  );

  // Missing variable bubbles up as MISSING_VARIABLE.
  await assert.rejects(
    sendTemplatedEmail({
      templateKey: "portal.magic-link",
      to: recipient,
      variables: { customerName: "Ada" },
    }),
    (error: unknown) =>
      error instanceof TemplatedEmailError && error.code === "MISSING_VARIABLE",
  );
}

async function portalMigrationTest() {
  const suffix = randomUUID().slice(0, 8);
  const created: { customerId?: string } = {};

  try {
    const customer = await db.customer.create({
      data: {
        displayName: `Portal Template ${suffix}`,
        email: `portal-template-${suffix}@example.test`,
        firstName: "Lena",
      },
    });
    created.customerId = customer.id;

    const before = await db.emailSend.count({
      where: { recipientEmail: customer.email ?? undefined },
    });

    const { token, emailRes } = await sendPortalLinkToCustomer(
      customer.id,
      "https://example.test",
    );
    assert.ok(token, "sendPortalLinkToCustomer should still return a token");
    assert.ok(emailRes.send.id, "sendPortalLinkToCustomer should return a persisted send id");
    assert.ok(
      emailRes.rendered.html.includes("https://example.test/portal/"),
      "rendered email should include the portal URL",
    );
    assert.ok(
      emailRes.rendered.html.includes("Lena"),
      "rendered email should address the customer by first name",
    );

    const after = await db.emailSend.count({
      where: { recipientEmail: customer.email ?? undefined },
    });
    assert.equal(after, before + 1, "portal email should record exactly one EmailSend row");
  } finally {
    if (created.customerId) {
      await db.portalToken.deleteMany({ where: { customerId: created.customerId } });
      await db.emailSend.deleteMany({
        where: { recipientEmail: { contains: `portal-template-` } },
      });
      await db.customer.deleteMany({ where: { id: created.customerId } });
    }
    await db.emailSend.deleteMany({
      where: { recipientEmail: { contains: "templates-smoke-" } },
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
