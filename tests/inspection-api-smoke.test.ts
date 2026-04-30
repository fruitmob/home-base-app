import { test } from "node:test";
import * as assert from "node:assert";
import { db } from "../lib/db";

test("Inspection API End-to-End Smoke Test", async () => {
  console.log("Starting Inspection API smoke test...");

  // 1. Setup minimal dependencies
  console.log("Creating test user, customer, and vehicle...");
  const user = await db.user.create({
    data: { email: `inspector${Date.now()}@test.com`, passwordHash: "dummy", role: "ADMIN" },
  });
  
  const customer = await db.customer.create({
    data: { firstName: "Test", lastName: "Customer", displayName: "Test Customer" },
  });

  const vehicle = await db.vehicle.create({
    data: { customerId: customer.id, make: "Ford", model: "F-150", year: 2020 },
  });

  try {
    // 2. Create Inspection via "API" simulation
    console.log("Creating Arrival Inspection...");
    const inspection = await db.arrivalInspection.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        type: "ARRIVAL",
        notes: "Initial check",
      },
    });

    assert.ok(inspection.id, "Failed to create inspection");
    assert.strictEqual(inspection.status, "DRAFT");

    // 3. Add Checklist Items
    console.log("Adding checklist items...");
    await db.inspectionItem.createMany({
      data: [
        { inspectionId: inspection.id, label: "Tire Tread", category: "Exterior", result: "PASS", displayOrder: 1 },
        { inspectionId: inspection.id, label: "Wiper Blades", category: "Exterior", result: "FAIL", displayOrder: 2 },
      ]
    });

    const items = await db.inspectionItem.findMany({
      where: { inspectionId: inspection.id }
    });

    assert.strictEqual(items.length, 2, "Failed to create items");
    const wiperItem = items.find(i => i.label === "Wiper Blades");

    // 4. Update an Item Result
    console.log("Updating checklist item result...");
    const updatedItem = await db.inspectionItem.update({
      where: { id: wiperItem!.id },
      data: { result: "ATTENTION", notes: "A bit streaky" }
    });
    
    assert.strictEqual(updatedItem.result, "ATTENTION");
    assert.strictEqual(updatedItem.notes, "A bit streaky");

    // 5. Complete Inspection
    console.log("Marking inspection complete...");
    const completed = await db.arrivalInspection.update({
      where: { id: inspection.id },
      data: { status: "COMPLETE", performedAt: new Date() }
    });

    assert.strictEqual(completed.status, "COMPLETE");
    assert.ok(completed.performedAt, "PerformedAt not set");

    // 6. Delete Inspection
    console.log("Soft deleting inspection...");
    const deleted = await db.arrivalInspection.update({
      where: { id: inspection.id },
      data: { deletedAt: new Date() }
    });
    assert.ok(deleted.deletedAt, "Failed to soft delete inspection");

    console.log("✅ Inspection API smoke test passed!");
  } finally {
    // Cleanup
    await db.arrivalInspection.deleteMany({ where: { customerId: customer.id } });
    await db.vehicle.deleteMany({ where: { id: vehicle.id } });
    await db.customer.deleteMany({ where: { id: customer.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
