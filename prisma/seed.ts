import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  AddressType,
  ActivityStatus,
  ActivityType,
  CasePriority,
  CaseStatus,
  CustomerType,
  LeadSource,
  LeadStatus,
  OpportunityStage,
  QuoteStatus,
  Role,
  VehicleNoteType,
  VendorType,
} from "@/generated/prisma/client";
import { lineTotal } from "@/lib/core/money";
import { ensureEmailTemplatesSeeded } from "@/lib/email/seed";

const DEFAULT_OWNER_EMAIL = "owner@homebase.local";
const DEMO_TRACER_NAME = "Clearwater Transit Authority";
const DEMO_SALES_TRACER_NAME = "Quarterly Fleet Refresh - Clearwater";
const DEMO_SALES_PASSWORD = "homebase-demo";

async function main() {
  const ownerUser = await seedOwner();
  await seedDemoCoreEntities(ownerUser.id);
  await seedDemoSalesData(ownerUser.id);
  await ensureEmailTemplatesSeeded();
}

async function seedOwner() {
  const email = (process.env.SEED_OWNER_EMAIL ?? DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  const suppliedPassword = process.env.SEED_OWNER_PASSWORD;
  const password = suppliedPassword || randomBytes(18).toString("base64url");

  if (!email) {
    throw new Error("SEED_OWNER_EMAIL cannot be empty.");
  }

  if (password.length < 8) {
    throw new Error("SEED_OWNER_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: Role.OWNER,
      preference: {
        create: {
          theme: "system",
          defaultLandingPage: "/",
          tableDensity: "comfortable",
        },
      },
    },
    update: {
      passwordHash,
      role: Role.OWNER,
      deletedAt: null,
    },
  });

  await db.userPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      theme: "system",
      defaultLandingPage: "/",
      tableDensity: "comfortable",
    },
    update: {},
  });

  console.log(`Seeded OWNER user: ${email}`);
  console.log(
    suppliedPassword
      ? "Password source: SEED_OWNER_PASSWORD"
      : `Generated password: ${password}`,
  );

  return user;
}

async function seedDemoCoreEntities(ownerUserId: string) {
  const tracer = await db.customer.findFirst({
    where: { displayName: DEMO_TRACER_NAME, deletedAt: null },
    select: { id: true },
  });

  if (tracer) {
    console.log("Demo core entities already seeded; skipping.");
    return;
  }

  await db.$transaction(async (tx) => {
    const clearwater = await tx.customer.create({
      data: {
        customerType: CustomerType.BUSINESS,
        displayName: DEMO_TRACER_NAME,
        companyName: DEMO_TRACER_NAME,
        email: "dispatch@clearwater-transit.example",
        phone: "555-0100",
        website: "https://clearwater-transit.example",
        defaultPaymentTerms: "Net 30",
        notes: "Municipal transit fleet. Scheduled PM every 90 days.",
        contacts: {
          create: [
            {
              firstName: "Dana",
              lastName: "Quinn",
              displayName: "Dana Quinn",
              title: "Fleet Coordinator",
              email: "dana.quinn@clearwater-transit.example",
              phone: "555-0101",
              isPrimary: true,
            },
            {
              firstName: "Marcus",
              lastName: "Webb",
              displayName: "Marcus Webb",
              title: "Maintenance Supervisor",
              email: "marcus.webb@clearwater-transit.example",
              phone: "555-0102",
            },
          ],
        },
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              label: "Accounts Payable",
              line1: "220 Harbor Street",
              city: "Bayview",
              state: "CA",
              postalCode: "94099",
              country: "US",
              isPrimary: true,
            },
            {
              type: AddressType.SERVICE,
              line1: "18 Depot Lane",
              city: "Bayview",
              state: "CA",
              postalCode: "94099",
              country: "US",
              isPrimary: true,
            },
          ],
        },
      },
    });

    await tx.vehicle.create({
      data: {
        customerId: clearwater.id,
        vin: "1FVACWDU7BHBT4014",
        normalizedVin: "1FVACWDU7BHBT4014",
        year: 2019,
        make: "New Flyer",
        model: "Xcelsior XN40",
        unitNumber: "CT-014",
        licensePlate: "CLR014",
        licenseState: "CA",
        color: "White",
        currentMileage: 187_420,
        mileageReadings: {
          create: [
            {
              value: 187_420,
              source: "seed.import",
              recordedAt: new Date(),
              note: "Intake from legacy fleet records.",
              recordedByUserId: ownerUserId,
            },
          ],
        },
        vehicleNotes: {
          create: [
            {
              type: VehicleNoteType.SERVICE_HISTORY,
              body: "Recent transmission service at 180,000 miles.",
              authorUserId: ownerUserId,
            },
          ],
        },
      },
    });

    await tx.vehicle.create({
      data: {
        customerId: clearwater.id,
        vin: "1FVACWDU7BHBT4027",
        normalizedVin: "1FVACWDU7BHBT4027",
        year: 2021,
        make: "New Flyer",
        model: "Xcelsior XN40",
        unitNumber: "CT-027",
        licensePlate: "CLR027",
        licenseState: "CA",
        color: "White",
        currentMileage: 94_310,
        mileageReadings: {
          create: [
            {
              value: 94_310,
              source: "seed.import",
              recordedAt: new Date(),
              recordedByUserId: ownerUserId,
            },
          ],
        },
      },
    });

    const harborCity = await tx.customer.create({
      data: {
        customerType: CustomerType.BUSINESS,
        displayName: "Harbor City Logistics",
        companyName: "Harbor City Logistics",
        email: "ops@harborcitylogistics.example",
        phone: "555-0110",
        defaultPaymentTerms: "Net 15",
        contacts: {
          create: [
            {
              firstName: "Ramon",
              lastName: "Diaz",
              displayName: "Ramon Diaz",
              title: "Operations Manager",
              email: "ramon.diaz@harborcitylogistics.example",
              phone: "555-0111",
              isPrimary: true,
            },
          ],
        },
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              line1: "409 Pier Avenue",
              city: "Coastwood",
              state: "OR",
              postalCode: "97015",
              country: "US",
              isPrimary: true,
            },
          ],
        },
      },
    });

    await tx.vehicle.create({
      data: {
        customerId: harborCity.id,
        vin: "1GNSKNKC5JR123456",
        normalizedVin: "1GNSKNKC5JR123456",
        year: 2018,
        make: "Freightliner",
        model: "MT45",
        unitNumber: "HCL-04",
        licensePlate: "HCL4VAN",
        licenseState: "OR",
        color: "Blue",
        currentMileage: 142_880,
        mileageReadings: {
          create: [
            {
              value: 142_880,
              source: "seed.import",
              recordedAt: new Date(),
              recordedByUserId: ownerUserId,
            },
          ],
        },
      },
    });

    const mountainRidge = await tx.customer.create({
      data: {
        customerType: CustomerType.BUSINESS,
        displayName: "Mountain Ridge School District",
        companyName: "Mountain Ridge School District",
        email: "transportation@mountainridge-schools.example",
        phone: "555-0120",
        defaultPaymentTerms: "Net 45",
        taxExempt: true,
        taxExemptId: "MRSD-EXEMPT-2019",
        contacts: {
          create: [
            {
              firstName: "Priya",
              lastName: "Sato",
              displayName: "Priya Sato",
              title: "Transportation Director",
              email: "priya.sato@mountainridge-schools.example",
              phone: "555-0121",
              isPrimary: true,
            },
          ],
        },
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              line1: "7 Schoolhouse Road",
              city: "Pine Hollow",
              state: "CO",
              postalCode: "81052",
              country: "US",
              isPrimary: true,
            },
            {
              type: AddressType.SERVICE,
              line1: "22 Transportation Yard",
              city: "Pine Hollow",
              state: "CO",
              postalCode: "81052",
              country: "US",
              isPrimary: true,
            },
          ],
        },
      },
    });

    await tx.vehicle.create({
      data: {
        customerId: mountainRidge.id,
        vin: "4DRBUS0A1HB000133",
        normalizedVin: "4DRBUS0A1HB000133",
        year: 2020,
        make: "Blue Bird",
        model: "Vision",
        unitNumber: "Bus 07",
        licensePlate: "MRS007",
        licenseState: "CO",
        color: "Yellow",
        currentMileage: 58_400,
        mileageReadings: {
          create: [
            {
              value: 58_400,
              source: "seed.import",
              recordedAt: new Date(),
              recordedByUserId: ownerUserId,
            },
          ],
        },
      },
    });

    await tx.customer.create({
      data: {
        customerType: CustomerType.INDIVIDUAL,
        displayName: "Evelyn Park",
        firstName: "Evelyn",
        lastName: "Park",
        email: "evelyn.park@example.net",
        phone: "555-0131",
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              line1: "812 Willow Court",
              city: "Pine Hollow",
              state: "CO",
              postalCode: "81052",
              country: "US",
              isPrimary: true,
            },
          ],
        },
        vehicles: {
          create: [
            {
              vin: "5TDKZRFH8JS900111",
              normalizedVin: "5TDKZRFH8JS900111",
              year: 2022,
              make: "Toyota",
              model: "Highlander",
              trim: "XLE",
              licensePlate: "PARK22",
              licenseState: "CO",
              color: "Silver",
              currentMileage: 24_160,
              mileageReadings: {
                create: [
                  {
                    value: 24_160,
                    source: "seed.import",
                    recordedAt: new Date(),
                    recordedByUserId: ownerUserId,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    await tx.customer.create({
      data: {
        customerType: CustomerType.INDIVIDUAL,
        displayName: "Sam Torres",
        firstName: "Sam",
        lastName: "Torres",
        email: "sam.torres@example.net",
        phone: "555-0141",
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              line1: "51 Ridgeview Drive",
              city: "Coastwood",
              state: "OR",
              postalCode: "97015",
              country: "US",
              isPrimary: true,
            },
          ],
        },
        vehicles: {
          create: [
            {
              vin: "1FTFW1ET5GFC12345",
              normalizedVin: "1FTFW1ET5GFC12345",
              year: 2016,
              make: "Ford",
              model: "F-150",
              trim: "XLT",
              licensePlate: "TRR150",
              licenseState: "OR",
              color: "Red",
              currentMileage: 112_900,
              mileageReadings: {
                create: [
                  {
                    value: 112_900,
                    source: "seed.import",
                    recordedAt: new Date(),
                    recordedByUserId: ownerUserId,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    await tx.customer.create({
      data: {
        customerType: CustomerType.INDIVIDUAL,
        displayName: "Walk-In Guest",
        isWalkIn: true,
        notes: "Placeholder for unscheduled walk-in traffic.",
      },
    });

    await tx.vendor.create({
      data: {
        vendorType: VendorType.PARTS,
        name: "Redwood Parts Supply",
        accountNumber: "HB-RPS-42",
        email: "sales@redwoodparts.example",
        phone: "555-0200",
        website: "https://redwoodparts.example",
        defaultPaymentTerms: "Net 30",
        contacts: {
          create: [
            {
              firstName: "Noor",
              lastName: "Bishara",
              displayName: "Noor Bishara",
              title: "Account Representative",
              email: "noor.bishara@redwoodparts.example",
              phone: "555-0201",
              isPrimary: true,
            },
          ],
        },
        addresses: {
          create: [
            {
              type: AddressType.BILLING,
              line1: "88 Industrial Parkway",
              city: "Bayview",
              state: "CA",
              postalCode: "94099",
              country: "US",
              isPrimary: true,
            },
          ],
        },
      },
    });

    await tx.vendor.create({
      data: {
        vendorType: VendorType.SERVICE,
        name: "Canyon Auto Electric",
        email: "shop@canyonautoelectric.example",
        phone: "555-0210",
        defaultPaymentTerms: "Net 15",
        contacts: {
          create: [
            {
              firstName: "Teagan",
              lastName: "Holt",
              displayName: "Teagan Holt",
              title: "Shop Foreman",
              email: "teagan.holt@canyonautoelectric.example",
              phone: "555-0211",
              isPrimary: true,
            },
          ],
        },
        addresses: {
          create: [
            {
              type: AddressType.SERVICE,
              line1: "14 Mechanic Row",
              city: "Pine Hollow",
              state: "CO",
              postalCode: "81052",
              country: "US",
              isPrimary: true,
            },
          ],
        },
      },
    });

    await tx.vendor.create({
      data: {
        vendorType: VendorType.PARTS,
        name: "Tidepool Fluids & Filters",
        accountNumber: "HB-TFF-07",
        email: "orders@tidepoolfluids.example",
        phone: "555-0220",
        defaultPaymentTerms: "Net 30",
      },
    });
  });

  console.log("Seeded demo core entities (customers, vehicles, vendors).");
}

async function seedDemoSalesData(ownerUserId: string) {
  const tracer = await db.opportunity.findFirst({
    where: { name: DEMO_SALES_TRACER_NAME, deletedAt: null },
    select: { id: true },
  });

  if (tracer) {
    console.log("Demo sales data already seeded; skipping.");
    return;
  }

  const demoPasswordHash = await hashPassword(DEMO_SALES_PASSWORD);
  const salesRep = await db.user.upsert({
    where: { email: "sales.rep@homebase.local" },
    create: {
      email: "sales.rep@homebase.local",
      passwordHash: demoPasswordHash,
      role: Role.SALES_REP,
    },
    update: {
      passwordHash: demoPasswordHash,
      role: Role.SALES_REP,
      deletedAt: null,
    },
  });
  const salesManager = await db.user.upsert({
    where: { email: "sales.manager@homebase.local" },
    create: {
      email: "sales.manager@homebase.local",
      passwordHash: demoPasswordHash,
      role: Role.SALES_MANAGER,
    },
    update: {
      passwordHash: demoPasswordHash,
      role: Role.SALES_MANAGER,
      deletedAt: null,
    },
  });

  await db.$transaction(async (tx) => {
    const clearwater = await tx.customer.findFirstOrThrow({
      where: { displayName: DEMO_TRACER_NAME, deletedAt: null },
      include: { vehicles: { where: { deletedAt: null }, take: 2 } },
    });
    const harbor = await tx.customer.findFirstOrThrow({
      where: { displayName: "Harbor City Logistics", deletedAt: null },
      include: { vehicles: { where: { deletedAt: null }, take: 1 } },
    });
    const mountain = await tx.customer.findFirstOrThrow({
      where: { displayName: "Mountain Ridge School District", deletedAt: null },
      include: { vehicles: { where: { deletedAt: null }, take: 1 } },
    });
    const evelyn = await tx.customer.findFirstOrThrow({
      where: { displayName: "Evelyn Park", deletedAt: null },
      include: { vehicles: { where: { deletedAt: null }, take: 1 } },
    });
    const sam = await tx.customer.findFirstOrThrow({
      where: { displayName: "Sam Torres", deletedAt: null },
      include: { vehicles: { where: { deletedAt: null }, take: 1 } },
    });

    const products = await Promise.all([
      tx.product.create({
        data: {
          sku: "HB-LAB-DIAG",
          name: "Diagnostic Labor",
          family: "Labor",
          isLabor: true,
          taxable: false,
          defaultUnitPrice: 145,
          defaultCost: 85,
        },
      }),
      tx.product.create({
        data: {
          sku: "HB-LAB-PM",
          name: "Preventive Maintenance Labor",
          family: "Labor",
          isLabor: true,
          taxable: false,
          defaultUnitPrice: 132,
          defaultCost: 78,
        },
      }),
      tx.product.create({
        data: {
          sku: "HB-FLT-INSPECT",
          name: "Fleet Inspection Package",
          family: "Service Package",
          isLabor: false,
          taxable: false,
          defaultUnitPrice: 420,
          defaultCost: 190,
        },
      }),
      tx.product.create({
        data: {
          sku: "HB-PART-BATT-GRP31",
          name: "Group 31 Commercial Battery",
          family: "Electrical",
          taxable: true,
          defaultUnitPrice: 285,
          defaultCost: 175,
        },
      }),
      tx.product.create({
        data: {
          sku: "HB-PART-CAMKIT",
          name: "Rear Camera Kit",
          family: "Upfit",
          taxable: true,
          defaultUnitPrice: 610,
          defaultCost: 390,
        },
      }),
      tx.product.create({
        data: {
          sku: "HB-FLUID-DEF25",
          name: "DEF 2.5 Gallon Case",
          family: "Fluids",
          taxable: true,
          defaultUnitPrice: 38,
          defaultCost: 22,
        },
      }),
    ]);

    const existingDefault = await tx.pricebook.findFirst({
      where: { isDefault: true, active: true, deletedAt: null },
      select: { id: true },
    });

    const standardPricebook = await tx.pricebook.create({
      data: {
        name: "Home Base Standard Demo",
        description: "Default demo pricing for general service quotes.",
        isDefault: existingDefault ? false : true,
        active: true,
      },
    });
    const fleetPricebook = await tx.pricebook.create({
      data: {
        name: "Home Base Fleet Demo",
        description: "Demo pricing for larger account work.",
        isDefault: false,
        active: true,
      },
    });

    await tx.pricebookEntry.createMany({
      data: [
        { pricebookId: standardPricebook.id, productId: products[0].id, unitPrice: 145 },
        { pricebookId: standardPricebook.id, productId: products[1].id, unitPrice: 132 },
        { pricebookId: standardPricebook.id, productId: products[2].id, unitPrice: 420 },
        { pricebookId: standardPricebook.id, productId: products[3].id, unitPrice: 285 },
        { pricebookId: standardPricebook.id, productId: products[4].id, unitPrice: 610 },
        { pricebookId: standardPricebook.id, productId: products[5].id, unitPrice: 38 },
        { pricebookId: fleetPricebook.id, productId: products[0].id, unitPrice: 132 },
        { pricebookId: fleetPricebook.id, productId: products[1].id, unitPrice: 118 },
        { pricebookId: fleetPricebook.id, productId: products[2].id, unitPrice: 375 },
        { pricebookId: fleetPricebook.id, productId: products[3].id, unitPrice: 260 },
        { pricebookId: fleetPricebook.id, productId: products[4].id, unitPrice: 575 },
      ],
    });

    await tx.customer.update({
      where: { id: clearwater.id },
      data: { defaultPricebookId: fleetPricebook.id },
    });
    await tx.customer.update({
      where: { id: harbor.id },
      data: { defaultPricebookId: fleetPricebook.id },
    });

    const leads = await Promise.all([
      tx.lead.create({
        data: {
          status: LeadStatus.NEW,
          source: LeadSource.WEB,
          companyName: "Bayview Airport Shuttle",
          displayName: "Bayview Airport Shuttle",
          email: "fleet@bayviewshuttle.example",
          phone: "555-0301",
          interest: "Quarterly PM agreement for airport vans",
          estimatedValue: 18000,
          ownerUserId: salesRep.id,
        },
      }),
      tx.lead.create({
        data: {
          status: LeadStatus.WORKING,
          source: LeadSource.REFERRAL,
          companyName: "Riverbend Parks Department",
          displayName: "Riverbend Parks Department",
          email: "parks-fleet@riverbend.example",
          phone: "555-0302",
          interest: "Seasonal truck inspections",
          estimatedValue: 9200,
          ownerUserId: salesRep.id,
        },
      }),
      tx.lead.create({
        data: {
          status: LeadStatus.QUALIFIED,
          source: LeadSource.PHONE,
          companyName: "Northline Waste Services",
          displayName: "Northline Waste Services",
          email: "maintenance@northlinewaste.example",
          phone: "555-0303",
          interest: "Camera kit installs for service trucks",
          estimatedValue: 14600,
          ownerUserId: salesManager.id,
        },
      }),
    ]);

    const opportunities = await Promise.all([
      tx.opportunity.create({
        data: {
          customerId: clearwater.id,
          vehicleId: clearwater.vehicles[0]?.id,
          ownerUserId: salesRep.id,
          name: DEMO_SALES_TRACER_NAME,
          stage: OpportunityStage.WON,
          amount: 24800,
          probability: 100,
          expectedCloseDate: new Date("2026-04-15T12:00:00.000Z"),
          closedAt: new Date("2026-04-16T15:00:00.000Z"),
          notes: "Fleet refresh agreement for inspection and PM work.",
        },
      }),
      tx.opportunity.create({
        data: {
          customerId: harbor.id,
          vehicleId: harbor.vehicles[0]?.id,
          ownerUserId: salesRep.id,
          name: "Harbor City Liftgate Retrofit",
          stage: OpportunityStage.PROPOSAL,
          amount: 11350,
          probability: 70,
          expectedCloseDate: new Date("2026-05-08T12:00:00.000Z"),
          notes: "Retrofit quote sent for delivery van liftgate package.",
        },
      }),
      tx.opportunity.create({
        data: {
          customerId: mountain.id,
          vehicleId: mountain.vehicles[0]?.id,
          ownerUserId: salesManager.id,
          name: "Mountain Ridge Summer Inspection",
          stage: OpportunityStage.NEGOTIATION,
          amount: 18750,
          probability: 80,
          expectedCloseDate: new Date("2026-05-20T12:00:00.000Z"),
          notes: "School bus summer inspection block before fall routes.",
        },
      }),
      tx.opportunity.create({
        data: {
          customerId: evelyn.id,
          vehicleId: evelyn.vehicles[0]?.id,
          ownerUserId: salesRep.id,
          name: "Evelyn Park Hybrid Service Plan",
          stage: OpportunityStage.QUALIFIED,
          amount: 1950,
          probability: 50,
          expectedCloseDate: new Date("2026-04-28T12:00:00.000Z"),
        },
      }),
      tx.opportunity.create({
        data: {
          customerId: sam.id,
          vehicleId: sam.vehicles[0]?.id,
          ownerUserId: salesRep.id,
          name: "Sam Torres Upfit Package",
          stage: OpportunityStage.LOST,
          amount: 4200,
          probability: 0,
          closedAt: new Date("2026-04-10T12:00:00.000Z"),
          lossReason: "Customer deferred the accessory package.",
        },
      }),
    ]);

    const quoteTemplate = await tx.quoteTemplate.create({
      data: {
        name: "Fleet PM Starter",
        description: "Common inspection and PM bundle for fleet proposals.",
        lineItems: {
          create: [
            {
              productId: products[2].id,
              sku: products[2].sku,
              description: products[2].name,
              quantity: 1,
              unitPrice: null,
              taxable: false,
              displayOrder: 0,
            },
            {
              productId: products[1].id,
              sku: products[1].sku,
              description: products[1].name,
              quantity: 4,
              unitPrice: null,
              taxable: false,
              displayOrder: 1,
            },
          ],
        },
      },
    });

    const quoteOneLineA = {
      quantity: 12,
      unitPrice: 375,
      lineTotal: lineTotal(12, 375),
    };
    const quoteOneLineB = {
      quantity: 30,
      unitPrice: 118,
      lineTotal: lineTotal(30, 118),
    };
    const quoteOneSubtotal = quoteOneLineA.lineTotal + quoteOneLineB.lineTotal;

    await tx.quote.create({
      data: {
        quoteNumber: "Q-202604-9001",
        customerId: clearwater.id,
        opportunityId: opportunities[0].id,
        pricebookId: fleetPricebook.id,
        status: QuoteStatus.ACCEPTED,
        issuedAt: new Date("2026-04-12T12:00:00.000Z"),
        validUntil: new Date("2026-05-12T12:00:00.000Z"),
        notes: "Fleet PM and inspection agreement.",
        subtotal: quoteOneSubtotal,
        taxTotal: 0,
        total: quoteOneSubtotal,
        createdByUserId: salesRep.id,
        lineItems: {
          create: [
            {
              productId: products[2].id,
              sku: products[2].sku,
              description: products[2].name,
              quantity: quoteOneLineA.quantity,
              unitPrice: quoteOneLineA.unitPrice,
              lineTotal: quoteOneLineA.lineTotal,
              taxable: false,
              displayOrder: 0,
            },
            {
              productId: products[1].id,
              sku: products[1].sku,
              description: products[1].name,
              quantity: quoteOneLineB.quantity,
              unitPrice: quoteOneLineB.unitPrice,
              lineTotal: quoteOneLineB.lineTotal,
              taxable: false,
              displayOrder: 1,
            },
          ],
        },
      },
    });

    const quoteTwoLineA = {
      quantity: 1,
      unitPrice: 575,
      lineTotal: lineTotal(1, 575),
    };
    const quoteTwoLineB = {
      quantity: 3,
      unitPrice: 132,
      lineTotal: lineTotal(3, 132),
    };
    const quoteTwoSubtotal = quoteTwoLineA.lineTotal + quoteTwoLineB.lineTotal;

    await tx.quote.create({
      data: {
        quoteNumber: "Q-202604-9002",
        customerId: harbor.id,
        opportunityId: opportunities[1].id,
        pricebookId: fleetPricebook.id,
        status: QuoteStatus.SENT,
        issuedAt: new Date("2026-04-18T12:00:00.000Z"),
        validUntil: new Date("2026-05-18T12:00:00.000Z"),
        notes: "Rear camera and labor package for delivery van.",
        subtotal: quoteTwoSubtotal,
        taxTotal: 0,
        total: quoteTwoSubtotal,
        createdByUserId: salesRep.id,
        lineItems: {
          create: [
            {
              productId: products[4].id,
              sku: products[4].sku,
              description: products[4].name,
              quantity: quoteTwoLineA.quantity,
              unitPrice: quoteTwoLineA.unitPrice,
              lineTotal: quoteTwoLineA.lineTotal,
              taxable: true,
              displayOrder: 0,
            },
            {
              productId: products[0].id,
              sku: products[0].sku,
              description: products[0].name,
              quantity: quoteTwoLineB.quantity,
              unitPrice: quoteTwoLineB.unitPrice,
              lineTotal: quoteTwoLineB.lineTotal,
              taxable: false,
              displayOrder: 1,
            },
          ],
        },
      },
    });

    const cases = await Promise.all([
      tx.case.create({
        data: {
          customerId: clearwater.id,
          vehicleId: clearwater.vehicles[1]?.id,
          openedByUserId: ownerUserId,
          assignedUserId: salesRep.id,
          status: CaseStatus.OPEN,
          priority: CasePriority.HIGH,
          subject: "Clarify PM schedule for unit CT-027",
          description: "Customer wants the recurring PM schedule aligned with low-route days.",
        },
      }),
      tx.case.create({
        data: {
          customerId: harbor.id,
          vehicleId: harbor.vehicles[0]?.id,
          openedByUserId: ownerUserId,
          assignedUserId: salesManager.id,
          status: CaseStatus.WAITING,
          priority: CasePriority.NORMAL,
          subject: "Liftgate power draw follow-up",
          description: "Waiting for customer approval on electrical inspection window.",
        },
      }),
    ]);

    await tx.activity.createMany({
      data: [
        {
          type: ActivityType.CALL,
          status: ActivityStatus.COMPLETED,
          subject: "Discovery call with Clearwater",
          body: "Confirmed quarterly fleet refresh scope.",
          completedAt: new Date("2026-04-05T14:00:00.000Z"),
          ownerUserId: salesRep.id,
          opportunityId: opportunities[0].id,
        },
        {
          type: ActivityType.EMAIL,
          status: ActivityStatus.COMPLETED,
          subject: "Sent accepted quote packet",
          body: "Sent final quote and next-step schedule.",
          completedAt: new Date("2026-04-12T14:00:00.000Z"),
          ownerUserId: salesRep.id,
          opportunityId: opportunities[0].id,
        },
        {
          type: ActivityType.MEETING,
          status: ActivityStatus.OPEN,
          subject: "Harbor City proposal review",
          dueAt: new Date("2026-04-24T16:00:00.000Z"),
          ownerUserId: salesRep.id,
          opportunityId: opportunities[1].id,
        },
        {
          type: ActivityType.TASK,
          status: ActivityStatus.OPEN,
          subject: "Prepare Mountain Ridge inspection roster",
          dueAt: new Date("2026-04-29T16:00:00.000Z"),
          ownerUserId: salesManager.id,
          opportunityId: opportunities[2].id,
        },
        {
          type: ActivityType.NOTE,
          status: ActivityStatus.COMPLETED,
          subject: "Lead qualification note",
          body: "Airport shuttle fleet has twelve active vans.",
          completedAt: new Date("2026-04-19T12:00:00.000Z"),
          ownerUserId: salesRep.id,
          leadId: leads[0].id,
        },
        {
          type: ActivityType.CALL,
          status: ActivityStatus.OPEN,
          subject: "Follow up on liftgate power draw",
          dueAt: new Date("2026-04-25T15:00:00.000Z"),
          ownerUserId: salesManager.id,
          caseId: cases[1].id,
        },
      ],
    });

    await tx.salesGoal.createMany({
      data: [
        {
          userId: salesRep.id,
          period: "2026-04",
          targetAmount: 30000,
          notes: "April sales goal for demo rep.",
        },
        {
          userId: salesManager.id,
          period: "2026-04",
          targetAmount: 45000,
          notes: "April team-assisted sales goal.",
        },
      ],
    });

    // Keep the variable live so the template creation is intentional and readable.
    void quoteTemplate;
  });

  console.log("Seeded demo sales data (leads, opportunities, activities, cases, catalog, quotes, goals).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
