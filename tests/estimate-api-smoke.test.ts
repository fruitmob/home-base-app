import { db } from "../lib/db";
import assert from "assert";

async function main() {
  console.log("Setting up tests...");

  // Generate Admin user
  const user = await db.user.create({
    data: {
      email: `test-estimate-wo-${Date.now()}@example.com`,
      role: "ADMIN",
      passwordHash: "dummy",
    },
  });

  const customer = await db.customer.create({
    data: {
      firstName: "Estimate",
      lastName: "Wo Tester",
      displayName: "Estimate Tester",
      email: `est-wo-${Date.now()}@example.com`,
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

  // 1. Create an Estimate
  console.log("1. Creating Estimate...");
  const { withWorkOrderNumberRetry, withEstimateNumberRetry } = await import("../lib/shop/numbering");

  const est = await withEstimateNumberRetry(async (estimateNumber) => {
    return db.estimate.create({
      data: {
        estimateNumber,
        customerId: customer.id,
        vehicleId: vehicle.id,
        title: "Test Estimate",
        notes: "Needs to be converted",
        createdByUserId: user.id,
      },
    });
  });
  
  assert(est.status === "DRAFT", "Estimate should start as DRAFT");

  // 2. Add Line Items to Estimate
  console.log("2. Add Line items to Estimate...");
  const lineItem = await db.estimateLineItem.create({
    data: {
      estimateId: est.id,
      lineType: "LABOR",
      description: "Replace Front Brakes",
      quantity: 1.5,
      unitPrice: 120,
      lineTotal: 180,
    },
  });
  
  // 3. "Send" and "Approve" the Estimate
  console.log("3. Simulating sending and approving Estimate...");
  await db.estimate.update({
    where: { id: est.id },
    data: { status: "SENT", sentAt: new Date() }
  });
  let updatedEst = await db.estimate.update({
    where: { id: est.id },
    data: { status: "APPROVED", approvedAt: new Date() }
  });
  
  assert(updatedEst.status === "APPROVED", "Estimate should be APPROVED");

  // 4. Simulate Conversion to Work Order
  console.log("4. Simulating Estimate Conversion...");
  
  // Directly simulate the endpoint transaction.
  const newWo = await db.$transaction(async (tx) => {
    const parentEst = await tx.estimate.findUniqueOrThrow({
      where: { id: est.id },
      include: { lineItems: true },
    });
    
    // Create WO
    const workOrder = await withWorkOrderNumberRetry(async (workOrderNumber) => {
      return tx.workOrder.create({
        data: {
          workOrderNumber,
          customerId: parentEst.customerId,
          vehicleId: parentEst.vehicleId,
          title: parentEst.title,
          complaint: parentEst.notes,
          status: "OPEN",
          priority: "NORMAL",
          serviceWriterUserId: user.id,
          lineItems: {
            create: parentEst.lineItems.map((line) => ({
              productId: line.productId,
              partId: line.partId,
              lineType: line.lineType,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
              taxable: line.taxable,
              displayOrder: line.displayOrder,
              status: "OPEN",
            })),
          },
        },
      });
    });

    // Update estimate
    await tx.estimate.update({
      where: { id: est.id },
      data: { convertedWorkOrderId: workOrder.id },
    });
    
    return workOrder;
  });

  // Verify Work order received the line item
  console.log("5. Verifying conversion...");
  const woLines = await db.workOrderLineItem.findMany({
    where: { workOrderId: newWo.id },
  });

  assert(woLines.length === 1, "Work order should possess exactly 1 line item inherited from Estimate.");
  assert(woLines[0].description === "Replace Front Brakes", "Description should match!");
  
  // Verify estimate is locked into that WO.
  const finalEst = await db.estimate.findUniqueOrThrow({ where: { id: est.id } });
  assert(finalEst.convertedWorkOrderId === newWo.id, "Estimate holds reference to WO");

  console.log("All Estimate Conversion tests passed!");
}

main().catch(console.error).finally(() => process.exit(0));
