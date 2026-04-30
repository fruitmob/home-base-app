import { randomUUID } from "node:crypto";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";

async function main() {
  const entityId = `audit-smoke-${randomUUID()}`;
  const request = new Request("http://homebase.local/tests/audit-smoke", {
    headers: {
      "x-forwarded-for": "127.0.0.1",
    },
  });

  await logAudit({
    action: "audit.smoke",
    entityType: "TestAudit",
    entityId,
    before: { ok: false },
    after: { ok: true },
    request,
  });

  const entry = await db.auditLog.findFirst({
    where: {
      action: "audit.smoke",
      entityType: "TestAudit",
      entityId,
    },
  });

  if (!entry) {
    throw new Error("Audit smoke test failed: no audit log row was written.");
  }

  if (entry.ipAddress !== "127.0.0.1") {
    throw new Error(`Audit smoke test failed: expected IP 127.0.0.1, got ${entry.ipAddress}.`);
  }

  console.log("Audit smoke test: OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
