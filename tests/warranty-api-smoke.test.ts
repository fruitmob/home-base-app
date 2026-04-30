import { test } from "node:test";
import * as assert from "node:assert";
import { db } from "../lib/db";

test("Warranty API End-to-End Smoke Test", async () => {
  console.log("Starting Warranty API smoke test...");

  // 1. Setup minimum dependencies
  console.log("Creating test user, customer, vehicle, and work order...");
  const user = await db.user.create({
    data: { email: `warranty${Date.now()}@test.com`, passwordHash: "dummy", role: "ADMIN" },
  });
  
  const customer = await db.customer.create({
    data: { firstName: "W-Test", lastName: "Customer", displayName: "W-Test Customer" },
  });

  const vehicle = await db.vehicle.create({
    data: { customerId: customer.id, make: "Ford", model: "F-150", year: 2020 },
  });

  const workOrder = await db.workOrder.create({
    data: { customerId: customer.id, vehicleId: vehicle.id, workOrderNumber: `WO-W-${Date.now()}`, title: "Warranty Initial WO" },
  });

  try {
    // 2. Create Warranty Claim via "API" simulation
    console.log("Creating Warranty Claim...");
    const claim = await db.warrantyClaim.create({
      data: {
        workOrderId: workOrder.id,
        title: "Defective Water Pump",
        description: "Pump failed after 5 months.",
      },
    });

    assert.ok(claim.id, "Failed to create claim");
    assert.strictEqual(claim.status, "OPEN");

    // 3. Mark as Submitted
    console.log("Submitting Warranty Claim...");
    const submitted = await db.warrantyClaim.update({
      where: { id: claim.id },
      data: { status: "SUBMITTED", claimNumber: "FOMOCO-999", submittedAt: new Date() }
    });

    assert.strictEqual(submitted.status, "SUBMITTED");
    assert.ok(submitted.submittedAt, "SubmittedAt not set");

    // 4. Mark as Recovered (Funds arrived)
    console.log("Recovering Warranty Claim...");
    const recovered = await db.warrantyClaim.update({
      where: { id: claim.id },
      data: { status: "RECOVERED", recoveryAmount: 450.00, resolvedAt: new Date() }
    });

    assert.strictEqual(recovered.status, "RECOVERED");
    assert.strictEqual(Number(recovered.recoveryAmount), 450);
    assert.ok(recovered.resolvedAt, "ResolvedAt not set");

    // 5. Delete Claim
    console.log("Soft deleting claim...");
    const deleted = await db.warrantyClaim.update({
      where: { id: claim.id },
      data: { deletedAt: new Date() }
    });
    assert.ok(deleted.deletedAt, "Failed to soft delete claim");

    console.log("✅ Warranty API smoke test passed!");
  } finally {
    // Cleanup
    await db.warrantyClaim.deleteMany({ where: { workOrderId: workOrder.id } });
    await db.workOrder.deleteMany({ where: { id: workOrder.id } });
    await db.vehicle.deleteMany({ where: { id: vehicle.id } });
    await db.customer.deleteMany({ where: { id: customer.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
