/**
 * Home Base demo tenant seeder — "Cedar Ridge Service"
 *
 * Usage
 *   npm run seed:demo
 *
 * Env
 *   SEED_DEMO_PASSWORD   Optional. Password for every seeded staff user.
 *                        Defaults to "cedar-ridge-demo".
 *
 * The seeder is idempotent — running it twice never duplicates data. It keys on
 * unique natural fields (email, workOrderNumber, sku, slug) and skips rows that
 * already exist. It is safe to run against a prod database as long as
 * SEED_DEMO_PASSWORD is set to something you are comfortable handing to a demo
 * reviewer.
 *
 * This file is intentionally self-contained so a deployer can read it top to
 * bottom while following DEPLOYMENT.md.
 */
import {
  InspectionItemResult,
  InspectionStatus,
  InspectionType,
  Role,
  TimeEntryStatus,
  VideoStatus,
  WorkOrderLineStatus,
  WorkOrderLineType,
  WorkOrderPriority,
  WorkOrderStatus,
  EstimateStatus,
  ChangeOrderStatus,
  KbArticleStatus,
} from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureEmailTemplatesSeeded } from "@/lib/email/seed";

const SHOP_NAME = "Cedar Ridge Service";
const DEFAULT_DEMO_PASSWORD = "cedar-ridge-demo";
const DEMO_DOMAIN = "cedarridge.demo";

type StaffSeed = {
  email: string;
  role: Role;
};

const STAFF_SEEDS: StaffSeed[] = [
  { email: `owner@${DEMO_DOMAIN}`, role: Role.OWNER },
  { email: `manager@${DEMO_DOMAIN}`, role: Role.SERVICE_MANAGER },
  { email: `writer@${DEMO_DOMAIN}`, role: Role.SERVICE_WRITER },
  { email: `tech@${DEMO_DOMAIN}`, role: Role.TECH },
  { email: `parts@${DEMO_DOMAIN}`, role: Role.PARTS },
  { email: `sales@${DEMO_DOMAIN}`, role: Role.SALES_REP },
];

type CustomerSeed = {
  displayName: string;
  email: string;
  phone: string;
};

const CUSTOMER_SEEDS: CustomerSeed[] = [
  {
    displayName: "Ridgeline Haulers",
    email: "dispatch@ridgelinehaulers.demo",
    phone: "555-0142",
  },
  {
    displayName: "Ponderosa Landscaping",
    email: "ops@ponderosa.demo",
    phone: "555-0178",
  },
  {
    displayName: "Summit Medical Response",
    email: "fleet@summitmedical.demo",
    phone: "555-0199",
  },
];

type VehicleSeed = {
  customerDisplayName: string;
  year: number;
  make: string;
  model: string;
  unitNumber: string;
  currentMileage: number;
  vin: string;
};

const VEHICLE_SEEDS: VehicleSeed[] = [
  {
    customerDisplayName: "Ridgeline Haulers",
    year: 2022,
    make: "Freightliner",
    model: "Cascadia 126",
    unitNumber: "RH-21",
    currentMileage: 184_200,
    vin: "1FUJGBDV0NLAB0001",
  },
  {
    customerDisplayName: "Ridgeline Haulers",
    year: 2020,
    make: "Peterbilt",
    model: "579",
    unitNumber: "RH-34",
    currentMileage: 312_500,
    vin: "1XPBD49X6LD720002",
  },
  {
    customerDisplayName: "Ponderosa Landscaping",
    year: 2019,
    make: "Ford",
    model: "F-550",
    unitNumber: "PL-08",
    currentMileage: 91_400,
    vin: "1FDUF5GT7KEB00003",
  },
  {
    customerDisplayName: "Ponderosa Landscaping",
    year: 2023,
    make: "Ram",
    model: "5500",
    unitNumber: "PL-12",
    currentMileage: 22_800,
    vin: "3C7WRMCL0PG000004",
  },
  {
    customerDisplayName: "Summit Medical Response",
    year: 2024,
    make: "Ford",
    model: "E-450",
    unitNumber: "SMR-102",
    currentMileage: 14_100,
    vin: "1FDXE4FS0RDA00005",
  },
  {
    customerDisplayName: "Summit Medical Response",
    year: 2022,
    make: "Ford",
    model: "E-450",
    unitNumber: "SMR-087",
    currentMileage: 71_000,
    vin: "1FDXE4FS0NDA00006",
  },
];

type PartSeed = {
  sku: string;
  name: string;
  manufacturer: string;
  unitCost: number;
  quantityOnHand: number;
  reorderPoint: number;
  binLocation: string;
};

const PART_SEEDS: PartSeed[] = [
  ...generatePartsBatch("AIR", "Air filter assembly", "FleetPro", 10, 38.5, 6),
  ...generatePartsBatch("OIL", "Synthetic 15W-40 oil, gallon", "HighlandLube", 8, 22.1, 10),
  ...generatePartsBatch("BRK", "Brake pad set, premium", "BraveStop", 8, 64.25, 4),
  ...generatePartsBatch("RTR", "Rotor disc", "BraveStop", 6, 81.9, 4),
  ...generatePartsBatch("FLT", "Fuel filter cartridge", "HighlandLube", 6, 28.3, 8),
  ...generatePartsBatch("HOS", "Coolant hose", "CedarFab", 6, 17.75, 6),
  ...generatePartsBatch("CLT", "Heavy-duty clutch kit", "Summit Drivetrain", 3, 645.0, 2),
  ...generatePartsBatch("ALT", "Alternator 200A", "Summit Electric", 3, 318.0, 2),
];

function generatePartsBatch(
  prefix: string,
  baseName: string,
  manufacturer: string,
  count: number,
  unitCost: number,
  reorderPoint: number,
): PartSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const sku = `CED-${prefix}-${String(index + 1).padStart(3, "0")}`;
    const onHand = index === 0 ? Math.max(0, reorderPoint - 2) : Math.round(reorderPoint * (2 + index * 0.4));
    return {
      sku,
      name: `${baseName} ${String.fromCharCode(65 + (index % 6))}${index + 1}`,
      manufacturer,
      unitCost,
      quantityOnHand: onHand,
      reorderPoint,
      binLocation: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    };
  });
}

type WorkOrderSeed = {
  workOrderNumber: string;
  customerDisplayName: string;
  vehicleUnitNumber: string;
  title: string;
  complaint: string;
  status: WorkOrderStatus;
  priority?: WorkOrderPriority;
  openedDaysAgo: number;
  closedDaysAgo?: number;
  assignTo: "tech" | "manager" | null;
  lines: Array<{
    lineType: WorkOrderLineType;
    description: string;
    quantity: number;
    unitPrice: number;
    status?: WorkOrderLineStatus;
    taxable?: boolean;
  }>;
  timeEntryMinutes?: number;
  inspection?: {
    type: InspectionType;
    status: InspectionStatus;
    items: Array<{ label: string; result: InspectionItemResult; notes?: string }>;
  };
};

const WORK_ORDER_SEEDS: WorkOrderSeed[] = [
  {
    workOrderNumber: "WO-CED-1001",
    customerDisplayName: "Ridgeline Haulers",
    vehicleUnitNumber: "RH-21",
    title: "PM service + DOT inspection",
    complaint: "Due for 25k service; tire wear noted on left rear.",
    status: WorkOrderStatus.IN_PROGRESS,
    openedDaysAgo: 2,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "PM service labor", quantity: 2, unitPrice: 145, taxable: false },
      { lineType: WorkOrderLineType.PART, description: "Synthetic 15W-40 oil, 10 gallons", quantity: 10, unitPrice: 32 },
      { lineType: WorkOrderLineType.PART, description: "Fuel filter cartridge set", quantity: 2, unitPrice: 44 },
    ],
    timeEntryMinutes: 95,
    inspection: {
      type: InspectionType.ARRIVAL,
      status: InspectionStatus.COMPLETE,
      items: [
        { label: "Tire tread depth", result: InspectionItemResult.ATTENTION, notes: "Left rear under 8/32" },
        { label: "Headlights", result: InspectionItemResult.PASS },
        { label: "Brake pads (front)", result: InspectionItemResult.PASS },
      ],
    },
  },
  {
    workOrderNumber: "WO-CED-1002",
    customerDisplayName: "Ridgeline Haulers",
    vehicleUnitNumber: "RH-34",
    title: "Clutch replacement",
    complaint: "Slipping under load; driver reports clutch smell.",
    status: WorkOrderStatus.ON_HOLD_PARTS,
    priority: WorkOrderPriority.HIGH,
    openedDaysAgo: 5,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Clutch R&R labor", quantity: 8, unitPrice: 155, taxable: false },
      { lineType: WorkOrderLineType.PART, description: "Heavy-duty clutch kit", quantity: 1, unitPrice: 995 },
    ],
    timeEntryMinutes: 240,
  },
  {
    workOrderNumber: "WO-CED-1003",
    customerDisplayName: "Ponderosa Landscaping",
    vehicleUnitNumber: "PL-08",
    title: "Brake job, front axle",
    complaint: "Front brake pulsation noted by driver.",
    status: WorkOrderStatus.QC,
    openedDaysAgo: 1,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Front brake labor", quantity: 2.5, unitPrice: 145, taxable: false },
      { lineType: WorkOrderLineType.PART, description: "Premium brake pad set", quantity: 1, unitPrice: 98 },
      { lineType: WorkOrderLineType.PART, description: "Rotor disc, front", quantity: 2, unitPrice: 125 },
    ],
    timeEntryMinutes: 150,
  },
  {
    workOrderNumber: "WO-CED-1004",
    customerDisplayName: "Ponderosa Landscaping",
    vehicleUnitNumber: "PL-12",
    title: "Pre-delivery inspection",
    complaint: "Confirm build spec and deliver keys.",
    status: WorkOrderStatus.OPEN,
    openedDaysAgo: 0,
    assignTo: null,
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "PDI labor", quantity: 1.5, unitPrice: 145, taxable: false },
    ],
    inspection: {
      type: InspectionType.PDI,
      status: InspectionStatus.DRAFT,
      items: [
        { label: "Body damage walkaround", result: InspectionItemResult.PASS },
        { label: "Infotainment boot test", result: InspectionItemResult.PASS },
      ],
    },
  },
  {
    workOrderNumber: "WO-CED-1005",
    customerDisplayName: "Summit Medical Response",
    vehicleUnitNumber: "SMR-102",
    title: "Emergency light retrofit",
    complaint: "Fleet-wide upgrade to LED beacon kit.",
    status: WorkOrderStatus.IN_PROGRESS,
    openedDaysAgo: 3,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Emergency light install", quantity: 4, unitPrice: 155, taxable: false },
      { lineType: WorkOrderLineType.PART, description: "LED beacon kit", quantity: 1, unitPrice: 1250 },
    ],
    timeEntryMinutes: 180,
  },
  {
    workOrderNumber: "WO-CED-1006",
    customerDisplayName: "Summit Medical Response",
    vehicleUnitNumber: "SMR-087",
    title: "Coolant leak diagnostic",
    complaint: "Driver topped off coolant twice last week.",
    status: WorkOrderStatus.ON_HOLD_DELAY,
    openedDaysAgo: 7,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Diagnostic time", quantity: 1.5, unitPrice: 145, taxable: false },
    ],
    timeEntryMinutes: 90,
  },
  {
    workOrderNumber: "WO-CED-1007",
    customerDisplayName: "Ridgeline Haulers",
    vehicleUnitNumber: "RH-21",
    title: "DEF sensor replacement",
    complaint: "Check engine light, code P20EE.",
    status: WorkOrderStatus.READY_TO_BILL,
    openedDaysAgo: 4,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "DEF sensor R&R", quantity: 2, unitPrice: 155, taxable: false },
      { lineType: WorkOrderLineType.PART, description: "DEF level sensor", quantity: 1, unitPrice: 210 },
    ],
    timeEntryMinutes: 120,
  },
  {
    workOrderNumber: "WO-CED-1008",
    customerDisplayName: "Ponderosa Landscaping",
    vehicleUnitNumber: "PL-08",
    title: "Trailer wiring repair",
    complaint: "Left brake light intermittent.",
    status: WorkOrderStatus.OPEN,
    openedDaysAgo: 1,
    assignTo: null,
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Wiring diagnostic", quantity: 1, unitPrice: 145, taxable: false },
    ],
  },
  {
    workOrderNumber: "WO-CED-1009",
    customerDisplayName: "Summit Medical Response",
    vehicleUnitNumber: "SMR-102",
    title: "Quarterly inspection",
    complaint: "Scheduled 90-day look.",
    status: WorkOrderStatus.OPEN,
    openedDaysAgo: 0,
    assignTo: null,
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Inspection labor", quantity: 1, unitPrice: 145, taxable: false },
    ],
  },
  {
    workOrderNumber: "WO-CED-1010",
    customerDisplayName: "Ridgeline Haulers",
    vehicleUnitNumber: "RH-34",
    title: "Alternator replacement",
    complaint: "Low voltage alarm; battery drains overnight.",
    status: WorkOrderStatus.QC,
    openedDaysAgo: 3,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Alternator R&R", quantity: 2, unitPrice: 155, taxable: false },
      { lineType: WorkOrderLineType.PART, description: "Alternator 200A", quantity: 1, unitPrice: 489 },
    ],
    timeEntryMinutes: 130,
  },
  {
    workOrderNumber: "WO-CED-1011",
    customerDisplayName: "Ponderosa Landscaping",
    vehicleUnitNumber: "PL-12",
    title: "Upfit ladder rack install",
    complaint: "Customer-supplied rack, install + final inspection.",
    status: WorkOrderStatus.IN_PROGRESS,
    openedDaysAgo: 2,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Rack install", quantity: 3, unitPrice: 145, taxable: false },
    ],
    timeEntryMinutes: 180,
  },
  {
    workOrderNumber: "WO-CED-1012",
    customerDisplayName: "Ridgeline Haulers",
    vehicleUnitNumber: "RH-21",
    title: "Closed service cycle",
    complaint: "Routine tire rotation, closed out cleanly.",
    status: WorkOrderStatus.CLOSED,
    openedDaysAgo: 14,
    closedDaysAgo: 12,
    assignTo: "tech",
    lines: [
      { lineType: WorkOrderLineType.LABOR, description: "Tire rotation", quantity: 0.75, unitPrice: 145, taxable: false },
    ],
    timeEntryMinutes: 45,
  },
];

async function main() {
  console.log(`Seeding ${SHOP_NAME} demo tenant...`);

  const password = (process.env.SEED_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD).trim();
  if (password.length < 8) {
    throw new Error("SEED_DEMO_PASSWORD must be at least 8 characters.");
  }
  const passwordHash = await hashPassword(password);

  const staff = await seedStaff(passwordHash);
  await ensureEmailTemplatesSeeded();
  const customers = await seedCustomers();
  const vehicles = await seedVehicles(customers);
  const parts = await seedParts();
  const workOrders = await seedWorkOrders(customers, vehicles, parts, staff);
  await seedEstimates(customers, vehicles, workOrders, staff);
  await seedChangeOrders(workOrders, staff);
  await seedKbAndTraining(staff);
  await seedVideo(staff, customers, vehicles, workOrders);

  console.log("Cedar Ridge Service seed complete.");
  console.log(`Staff login password: "${password}" (change after the demo).`);
}

type StaffByRole = Map<Role, { id: string; email: string }>;

async function seedStaff(passwordHash: string): Promise<StaffByRole> {
  const result: StaffByRole = new Map();
  for (const entry of STAFF_SEEDS) {
    const email = entry.email.toLowerCase();
    const user = await db.user.upsert({
      where: { email },
      create: { email, role: entry.role, passwordHash },
      update: { role: entry.role },
    });
    result.set(entry.role, { id: user.id, email: user.email });
  }
  return result;
}

type CustomersByName = Map<string, string>;

async function seedCustomers(): Promise<CustomersByName> {
  const map: CustomersByName = new Map();
  for (const seed of CUSTOMER_SEEDS) {
    const existing = await db.customer.findFirst({
      where: { displayName: seed.displayName, deletedAt: null },
    });
    if (existing) {
      map.set(seed.displayName, existing.id);
      continue;
    }
    const customer = await db.customer.create({
      data: {
        displayName: seed.displayName,
        email: seed.email,
        phone: seed.phone,
      },
    });
    map.set(seed.displayName, customer.id);
  }
  return map;
}

type VehiclesByUnit = Map<string, { id: string; customerId: string }>;

async function seedVehicles(customers: CustomersByName): Promise<VehiclesByUnit> {
  const map: VehiclesByUnit = new Map();
  for (const seed of VEHICLE_SEEDS) {
    const customerId = customers.get(seed.customerDisplayName);
    if (!customerId) {
      throw new Error(`Unknown customer: ${seed.customerDisplayName}`);
    }
    const existing = await db.vehicle.findFirst({
      where: { unitNumber: seed.unitNumber, customerId, deletedAt: null },
    });
    if (existing) {
      map.set(seed.unitNumber, { id: existing.id, customerId });
      continue;
    }
    const vehicle = await db.vehicle.create({
      data: {
        customerId,
        year: seed.year,
        make: seed.make,
        model: seed.model,
        unitNumber: seed.unitNumber,
        vin: seed.vin,
        currentMileage: seed.currentMileage,
      },
    });
    map.set(seed.unitNumber, { id: vehicle.id, customerId });
  }
  return map;
}

type PartsBySku = Map<string, { id: string; unitCost: number }>;

async function seedParts(): Promise<PartsBySku> {
  const map: PartsBySku = new Map();
  for (const seed of PART_SEEDS) {
    const part = await db.part.upsert({
      where: { sku: seed.sku },
      create: {
        sku: seed.sku,
        name: seed.name,
        manufacturer: seed.manufacturer,
        unitCost: seed.unitCost,
        quantityOnHand: seed.quantityOnHand,
        reorderPoint: seed.reorderPoint,
        binLocation: seed.binLocation,
        active: true,
      },
      update: {
        name: seed.name,
        manufacturer: seed.manufacturer,
        unitCost: seed.unitCost,
        reorderPoint: seed.reorderPoint,
        binLocation: seed.binLocation,
      },
    });
    map.set(seed.sku, { id: part.id, unitCost: seed.unitCost });
  }
  return map;
}

type WorkOrdersByNumber = Map<string, { id: string }>;

async function seedWorkOrders(
  customers: CustomersByName,
  vehicles: VehiclesByUnit,
  parts: PartsBySku,
  staff: StaffByRole,
): Promise<WorkOrdersByNumber> {
  void parts;
  const map: WorkOrdersByNumber = new Map();
  for (const seed of WORK_ORDER_SEEDS) {
    const customerId = customers.get(seed.customerDisplayName);
    const vehicle = vehicles.get(seed.vehicleUnitNumber);
    if (!customerId || !vehicle) {
      throw new Error(
        `Unknown customer/vehicle for ${seed.workOrderNumber}: ${seed.customerDisplayName}/${seed.vehicleUnitNumber}`,
      );
    }

    const existing = await db.workOrder.findFirst({
      where: { workOrderNumber: seed.workOrderNumber },
    });
    if (existing) {
      map.set(seed.workOrderNumber, { id: existing.id });
      continue;
    }

    const openedAt = daysAgo(seed.openedDaysAgo);
    const closedAt = seed.closedDaysAgo !== undefined ? daysAgo(seed.closedDaysAgo) : null;
    const serviceWriterUserId = staff.get(Role.SERVICE_WRITER)?.id ?? null;
    const assignedTechUserId =
      seed.assignTo === "tech"
        ? staff.get(Role.TECH)?.id ?? null
        : seed.assignTo === "manager"
          ? staff.get(Role.SERVICE_MANAGER)?.id ?? null
          : null;

    const workOrder = await db.workOrder.create({
      data: {
        workOrderNumber: seed.workOrderNumber,
        customerId,
        vehicleId: vehicle.id,
        serviceWriterUserId,
        assignedTechUserId,
        status: seed.status,
        priority: seed.priority ?? WorkOrderPriority.NORMAL,
        title: seed.title,
        complaint: seed.complaint,
        openedAt,
        closedAt,
        lineItems: {
          create: seed.lines.map((line, index) => ({
            lineType: line.lineType,
            description: line.description,
            status: line.status ?? WorkOrderLineStatus.OPEN,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: roundTotal(line.quantity * line.unitPrice),
            taxable: line.taxable ?? true,
            displayOrder: index + 1,
          })),
        },
      },
    });
    map.set(seed.workOrderNumber, { id: workOrder.id });

    if (seed.timeEntryMinutes && assignedTechUserId) {
      const startedAt = new Date(openedAt.getTime() + 30 * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + seed.timeEntryMinutes * 60 * 1000);
      await db.timeEntry.create({
        data: {
          workOrderId: workOrder.id,
          userId: assignedTechUserId,
          status:
            seed.status === WorkOrderStatus.CLOSED
              ? TimeEntryStatus.APPROVED
              : seed.status === WorkOrderStatus.READY_TO_BILL
                ? TimeEntryStatus.SUBMITTED
                : TimeEntryStatus.DRAFT,
          active: false,
          startedAt,
          endedAt,
          durationMinutes: seed.timeEntryMinutes,
          billableMinutes: seed.timeEntryMinutes,
          goodwillMinutes: 0,
        },
      });
    }

    if (seed.inspection) {
      await db.arrivalInspection.create({
        data: {
          workOrderId: workOrder.id,
          customerId,
          vehicleId: vehicle.id,
          performedByUserId: assignedTechUserId,
          type: seed.inspection.type,
          status: seed.inspection.status,
          performedAt:
            seed.inspection.status === InspectionStatus.COMPLETE ? openedAt : null,
          items: {
            create: seed.inspection.items.map((item, index) => ({
              label: item.label,
              result: item.result,
              notes: item.notes,
              displayOrder: index + 1,
            })),
          },
        },
      });
    }
  }
  return map;
}

async function seedEstimates(
  customers: CustomersByName,
  vehicles: VehiclesByUnit,
  workOrders: WorkOrdersByNumber,
  staff: StaffByRole,
) {
  void workOrders;
  const number = "EST-CED-2001";
  const existing = await db.estimate.findFirst({ where: { estimateNumber: number } });
  if (existing) return;

  const customerId = customers.get("Summit Medical Response");
  const vehicle = vehicles.get("SMR-087");
  const createdByUserId = staff.get(Role.SERVICE_WRITER)?.id ?? null;
  if (!customerId || !vehicle) return;

  await db.estimate.create({
    data: {
      estimateNumber: number,
      customerId,
      vehicleId: vehicle.id,
      createdByUserId,
      status: EstimateStatus.SENT,
      title: "Coolant system overhaul",
      subtotal: 2450,
      taxTotal: 0,
      total: 2450,
      sentAt: daysAgo(1),
      lineItems: {
        create: [
          {
            lineType: WorkOrderLineType.LABOR,
            description: "Coolant system diagnostic + replacement labor",
            quantity: 6,
            unitPrice: 155,
            lineTotal: roundTotal(6 * 155),
            taxable: false,
            displayOrder: 1,
          },
          {
            lineType: WorkOrderLineType.PART,
            description: "Radiator assembly",
            quantity: 1,
            unitPrice: 820,
            lineTotal: 820,
            taxable: true,
            displayOrder: 2,
          },
          {
            lineType: WorkOrderLineType.PART,
            description: "Coolant hose kit",
            quantity: 1,
            unitPrice: 260,
            lineTotal: 260,
            taxable: true,
            displayOrder: 3,
          },
        ],
      },
    },
  });
}

async function seedChangeOrders(workOrders: WorkOrdersByNumber, staff: StaffByRole) {
  const workOrder = workOrders.get("WO-CED-1007");
  if (!workOrder) return;

  const number = "CO-CED-3001";
  const existing = await db.changeOrder.findFirst({ where: { changeOrderNumber: number } });
  if (existing) return;

  await db.changeOrder.create({
    data: {
      changeOrderNumber: number,
      workOrderId: workOrder.id,
      requestedByUserId: staff.get(Role.SERVICE_WRITER)?.id ?? null,
      status: ChangeOrderStatus.APPROVED,
      title: "Add DEF sensor harness",
      subtotal: 210,
      taxTotal: 0,
      total: 210,
      approvedAt: daysAgo(1),
    },
  });
}

async function seedKbAndTraining(staff: StaffByRole) {
  const owner = staff.get(Role.OWNER);
  const tech = staff.get(Role.TECH);
  if (!owner || !tech) return;

  const existingCategory = await db.kbCategory.findFirst({
    where: { name: "Shop procedures" },
  });
  const category =
    existingCategory ??
    (await db.kbCategory.create({ data: { name: "Shop procedures" } }));

  const slug = "cedar-ridge-def-sensor-replacement";
  const existingArticle = await db.kbArticle.findUnique({ where: { slug } });
  const article =
    existingArticle ??
    (await db.kbArticle.create({
      data: {
        title: "DEF sensor replacement — Cedar Ridge playbook",
        slug,
        status: KbArticleStatus.PUBLISHED,
        body:
          "## Overview\n\nThis playbook covers the standard DEF level-sensor replacement for Cedar Ridge Class 7 and Class 8 trucks.\n\n1. Verify fault code P20EE is present before removing the sensor.\n2. Drain DEF to below the sensor level.\n3. Torque the new sensor to 10 Nm.\n4. Clear codes and road-test for 20 minutes under load.\n",
        authorId: owner.id,
        categoryId: category.id,
      },
    }));

  const existingAssignment = await db.trainingAssignment.findFirst({
    where: { assignedToId: tech.id, articleId: article.id, deletedAt: null },
  });
  if (!existingAssignment) {
    await db.trainingAssignment.create({
      data: {
        articleId: article.id,
        assignedToId: tech.id,
        assignedById: owner.id,
        dueAt: daysFromNow(10),
      },
    });
  }
}

async function seedVideo(
  staff: StaffByRole,
  customers: CustomersByName,
  vehicles: VehiclesByUnit,
  workOrders: WorkOrdersByNumber,
) {
  const tech = staff.get(Role.TECH);
  if (!tech) return;

  const cloudflareId = "cedar-ridge-demo-walkaround-001";
  const existing = await db.video.findUnique({ where: { cloudflareId } });
  if (existing) return;

  const vehicle = vehicles.get("RH-21");
  const customerId = customers.get("Ridgeline Haulers");
  const workOrder = workOrders.get("WO-CED-1001");

  await db.video.create({
    data: {
      cloudflareId,
      status: VideoStatus.READY,
      title: "RH-21 arrival walkaround",
      description: "Customer-ready demo video showing documented tire condition on arrival.",
      durationSeconds: 84,
      uploadedByUserId: tech.id,
      workOrderId: workOrder?.id ?? null,
      vehicleId: vehicle?.id ?? null,
      customerId: customerId ?? null,
    },
  });
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function roundTotal(value: number): number {
  return Math.round(value * 100) / 100;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
