import { db } from "../lib/db";
import { receivePart, reservePart, issuePartReservation, releasePartReservation, adjustPartQuantity } from "../lib/shop/parts";
import assert from "assert";

async function main() {
  console.log("Setting up tests...");
  // Create a user
  const user = await db.user.create({
    data: {
      email: `test-parts-${Date.now()}@example.com`,
      role: "ADMIN",
      passwordHash: "dummy",
    },
  });

  // Create Customer & Vehicle & WorkOrder
  const customer = await db.customer.create({
    data: {
        firstName: "Parts",
        lastName: "Tester",
        displayName: "Parts Tester",
        email: `parts-${Date.now()}@example.com`,
      phone: "555-PARTS",
    },
  });
  
  const vehicle = await db.vehicle.create({
    data: {
      customerId: customer.id,
      make: "Ford",
      model: "Transit",
      year: 2021,
      vin: `TESTVIN${Date.now()}`.slice(0, 17),
    },
  });

  const wo = await db.workOrder.create({
    data: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      workOrderNumber: `WO-TEST-${Date.now()}`,
      title: "Test Parts Pipeline",
    },
  });

  const lineItem = await db.workOrderLineItem.create({
    data: {
      workOrderId: wo.id,
      lineType: "PART",
      description: "Test Part Install",
    },
  });

  // 1. Create a part
  console.log("1. Creating part...");
  const sku = `PK-${Date.now()}`;
  let part = await db.part.create({
    data: {
      name: "Brake Pads",
      sku,
      unitCost: 45.0,
      reorderPoint: 5,
    },
  });

  assert(Number(part.quantityOnHand) === 0, "New part should have 0 on hand");
  
  // 2. Receive 10 units
  console.log("2. Receiving 10 units...");
  await receivePart(part.id, 10, 45.0, "PO-123", "Test receive", { userId: user.id });
  part = await db.part.findUniqueOrThrow({ where: { id: part.id } });
  
  assert(Number(part.quantityOnHand) === 10, "Should have 10 on hand after receiving");
  
  // 3. Reserve 3 units
  console.log("3. Reserving 3 units...");
  const reservation = await reservePart(part.id, 3, wo.id, lineItem.id, { userId: user.id });
  part = await db.part.findUniqueOrThrow({ where: { id: part.id } });

  assert(Number(part.quantityReserved) === 3, "Should have 3 reserved");
  assert(Number(part.quantityOnHand) === 10, "Should still have 10 on hand (just reserved)");

  // 4. Over-reserve (try reserving 8, should fail 10 - 3 = 7 available)
  console.log("4. Attempting to over-reserve...");
  try {
    await reservePart(part.id, 8, wo.id, undefined, { userId: user.id });
    assert.fail("Should have thrown error for over-reservation");
  } catch (err: any) {
    if (err.name === "AssertionError") throw err;
    assert(err.message.includes("Requested quantity exceeds available stock"), "Failed with wrong error message");
  }

  // 5. Issue the reservation
  console.log("5. Issuing the reservation...");
  await issuePartReservation(reservation.id, 3, { userId: user.id });
  part = await db.part.findUniqueOrThrow({ where: { id: part.id } });

  assert(Number(part.quantityReserved) === 0, "Should have 0 reserved after issuing");
  assert(Number(part.quantityOnHand) === 7, "Should have 7 on hand after issuing 3 from 10");

  // 6. Adjust (Reconciliation)
  console.log("6. Adjusting quantity...");
  // Let's say physical count is actually 6. We need to decrease by 1.
  await adjustPartQuantity(part.id, -1, "InvCount2024", "Found one missing", { userId: user.id });
  part = await db.part.findUniqueOrThrow({ where: { id: part.id } });
  assert(Number(part.quantityOnHand) === 6, "Should have 6 on hand after adjustment");

  // Verify ledgers
  const tx = await db.partTransaction.findMany({ where: { partId: part.id }, orderBy: { occurredAt: 'asc' }});
  assert(tx.length === 4, "Should have exactly 4 transactions (Receive, Reserve, Issue, Adjust)");
  assert(tx[0].type === "RECEIVE");
  assert(tx[1].type === "RESERVE");
  assert(tx[2].type === "ISSUE");
  assert(tx[3].type === "ADJUST");

  console.log("All Part Inventory tests passed!");
}

main().catch(console.error).finally(() => process.exit(0));
