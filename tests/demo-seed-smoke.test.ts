import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { db } from "@/lib/db";

const DEMO_SHOP = "Cedar Ridge Service";
const CUSTOMER_NAMES = ["Ridgeline Haulers", "Ponderosa Landscaping", "Summit Medical Response"];
const VEHICLE_VINS = [
  "1FUJGBDV0NLAB0001",
  "1XPBD49X6LD720002",
  "1FDUF5GT7KEB00003",
  "3C7WRMCL0PG000004",
  "1FDXE4FS0RDA00005",
  "1FDXE4FS0NDA00006",
];
const WORK_ORDER_PREFIX = "WO-CED-";
const STAFF_EMAIL_DOMAIN = "@cedarridge.demo";
const EXPECTED_WORK_ORDERS = 12;
const EXPECTED_STAFF = 6;
const EXPECTED_PARTS_PREFIX = "CED-";

async function main() {
  console.log(`Smoke-testing the ${DEMO_SHOP} demo seeder.`);

  // First run — either creates rows or is a no-op depending on DB state.
  await runSeed();
  const first = await snapshot();
  assertSnapshotLooksLikeDemo(first);

  // Second run — must be idempotent.
  await runSeed();
  const second = await snapshot();
  assertSnapshotLooksLikeDemo(second);

  assert.deepEqual(first, second, "running the seeder twice should not change row counts");

  console.log("Demo seed smoke test: OK");
}

async function runSeed(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", "scripts/seed-demo.ts"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD ?? "cedar-ridge-demo-123",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`seed-demo.ts exited with code ${code}`));
    });
  });
}

type Snapshot = {
  staff: number;
  customers: number;
  vehicles: number;
  workOrders: number;
  parts: number;
  estimates: number;
  changeOrders: number;
  kbArticles: number;
  trainingAssignments: number;
  videos: number;
};

async function snapshot(): Promise<Snapshot> {
  const [
    staff,
    customers,
    vehicles,
    workOrders,
    parts,
    estimates,
    changeOrders,
    kbArticles,
    trainingAssignments,
    videos,
  ] = await Promise.all([
    db.user.count({
      where: { deletedAt: null, email: { endsWith: STAFF_EMAIL_DOMAIN } },
    }),
    db.customer.count({
      where: { deletedAt: null, displayName: { in: CUSTOMER_NAMES } },
    }),
    db.vehicle.count({
      where: { deletedAt: null, vin: { in: VEHICLE_VINS } },
    }),
    db.workOrder.count({
      where: { deletedAt: null, workOrderNumber: { startsWith: WORK_ORDER_PREFIX } },
    }),
    db.part.count({
      where: { deletedAt: null, sku: { startsWith: EXPECTED_PARTS_PREFIX } },
    }),
    db.estimate.count({
      where: { deletedAt: null, estimateNumber: { startsWith: "EST-CED-" } },
    }),
    db.changeOrder.count({
      where: { deletedAt: null, changeOrderNumber: { startsWith: "CO-CED-" } },
    }),
    db.kbArticle.count({
      where: { deletedAt: null, slug: "cedar-ridge-def-sensor-replacement" },
    }),
    db.trainingAssignment.count({
      where: {
        deletedAt: null,
        article: { slug: "cedar-ridge-def-sensor-replacement" },
      },
    }),
    db.video.count({
      where: { deletedAt: null, cloudflareId: "cedar-ridge-demo-walkaround-001" },
    }),
  ]);

  return {
    staff,
    customers,
    vehicles,
    workOrders,
    parts,
    estimates,
    changeOrders,
    kbArticles,
    trainingAssignments,
    videos,
  };
}

function assertSnapshotLooksLikeDemo(snap: Snapshot) {
  assert.equal(snap.staff, EXPECTED_STAFF, "expected six seeded staff users");
  assert.equal(snap.customers, CUSTOMER_NAMES.length, "expected three seeded customers");
  assert.equal(snap.vehicles, VEHICLE_VINS.length, "expected six seeded vehicles");
  assert.equal(snap.workOrders, EXPECTED_WORK_ORDERS, "expected twelve seeded work orders");
  assert.ok(snap.parts >= 40, "expected at least forty seeded parts");
  assert.equal(snap.estimates, 1, "expected one seeded estimate");
  assert.equal(snap.changeOrders, 1, "expected one seeded change order");
  assert.equal(snap.kbArticles, 1, "expected one seeded KB article");
  assert.equal(snap.trainingAssignments, 1, "expected one seeded training assignment");
  assert.equal(snap.videos, 1, "expected one seeded Lens video");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
