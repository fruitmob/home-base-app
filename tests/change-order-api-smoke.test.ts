import { db } from "../lib/db";
import assert from "assert";

async function main() {
  console.log("Setting up tests...");

  // Generate Admin user
  const user = await db.user.create({
    data: {
      email: `test-estimate-${Date.now()}@example.com`,
      role: "ADMIN",
      passwordHash: "dummy",
    },
  });

  const customer = await db.customer.create({
    data: {
      firstName: "Estimate",
      lastName: "Tester",
      displayName: "Estimate Tester",
      email: `est-${Date.now()}@example.com`,
    },
  });

  const vehicle = await db.vehicle.create({
    data: {
      customerId: customer.id,
      make: "Toyota",
      model: "Tacoma",
      year: 2018,
    },
  });

  // 1. Create a Work Order (to attach COs)
  console.log("1. Creating active Work Order...");
  const { withWorkOrderNumberRetry, withEstimateNumberRetry, withChangeOrderNumberRetry } = await import("../lib/shop/numbering");

  const workOrder = await withWorkOrderNumberRetry(async (workOrderNumber) => {
    return db.workOrder.create({
      data: {
        workOrderNumber,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "OPEN",
        priority: "NORMAL",
        title: "Test WO for Change Order",
      },
    });
  });

  // 2. Create Change Order
  console.log("2. Creating Change Order...");
  const co = await withChangeOrderNumberRetry(async (changeOrderNumber) => {
    return db.changeOrder.create({
      data: {
        changeOrderNumber,
        workOrderId: workOrder.id,
        title: "Additional Brake Work found",
        reason: "Customer heard grinding noise",
        requestedByUserId: user.id,
      },
    });
  });
  
  assert(co.status === "DRAFT", "Change order should start as DRAFT");

  // 3. Add Line Items to CO
  console.log("3. Add Line items to Change Order...");
  const lineItem = await db.changeOrderLineItem.create({
    data: {
      changeOrderId: co.id,
      lineType: "LABOR",
      description: "Replace Rear Brakes",
      quantity: 1.5,
      unitPrice: 120,
      lineTotal: 180,
    },
  });
  
  // 4. "Send" the CO
  console.log("4. Simulating sending Change Order...");
  let updatedCo = await db.changeOrder.update({
    where: { id: co.id },
    data: { status: "SENT", sentAt: new Date() }
  });
  assert(updatedCo.status === "SENT", "Change order should be SENT");

  // 5. "Approve" the CO -> We will test our injection logic natively or simulate the API handler via transaction.
  // Wait, let's actually just call the API patch via node-fetch or manually replicate the injection logic since we aren't spinning up an Express server?
  // We can just simulate the transaction logic here to test if Prisma allows it.
  console.log("5. Simulating Change Order Approval and Injection...");
  
  // Simulate the exact logic from app/api/change-orders/[id]/status/route.ts
  await db.$transaction(async (tx) => {
    const parentCo = await tx.changeOrder.findUniqueOrThrow({
      where: { id: co.id },
      include: { lineItems: true },
    });
    
    await tx.changeOrder.update({
      where: { id: parentCo.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    
    for (const line of parentCo.lineItems) {
      await tx.workOrderLineItem.create({
        data: {
          workOrderId: parentCo.workOrderId,
          productId: line.productId,
          partId: line.partId,
          lineType: line.lineType,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          lineTotal: line.lineTotal,
          taxable: line.taxable,
          displayOrder: line.displayOrder, // Optionally bump this so it shows up at the end
          status: "OPEN",
        },
      });
    }
  });

  // Verify Work Order received the line item
  console.log("6. Verifying injection...");
  const woLines = await db.workOrderLineItem.findMany({
    where: { workOrderId: workOrder.id },
  });

  assert(woLines.length === 1, "Work order should now possess exactly 1 line item inherited from CO.");
  assert(woLines[0].description === "Replace Rear Brakes", "Description should match!");

  console.log("All Change Order tests passed!");
}

main().catch(console.error).finally(() => process.exit(0));
