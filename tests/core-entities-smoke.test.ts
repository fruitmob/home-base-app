import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { POST as createCustomerAddress } from "@/app/api/customers/[id]/addresses/route";
import { POST as createCustomerContact } from "@/app/api/customers/[id]/contacts/route";
import {
  DELETE as deleteCustomer,
  GET as getCustomer,
} from "@/app/api/customers/[id]/route";
import {
  GET as listCustomers,
  POST as createCustomer,
} from "@/app/api/customers/route";
import { GET as searchCoreEntities } from "@/app/api/search/core-entities/route";
import {
  GET as listVehicles,
  POST as createVehicle,
} from "@/app/api/vehicles/route";
import { PATCH as updateVehicle } from "@/app/api/vehicles/[id]/route";
import { POST as createVehicleNote } from "@/app/api/vehicles/[id]/notes/route";
import { POST as createVendorContact } from "@/app/api/vendors/[id]/contacts/route";
import {
  GET as listVendors,
  POST as createVendor,
} from "@/app/api/vendors/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const csrfToken = "core-entities-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type CustomerPayload = {
  customer: { id: string; displayName: string; deletedAt: string | null };
};

type ContactPayload = {
  contact: { id: string; displayName: string; isPrimary: boolean };
};

type AddressPayload = {
  address: { id: string; city: string; isPrimary: boolean };
};

type VehiclePayload = {
  vehicle: { id: string; normalizedVin: string | null; currentMileage: number | null };
};

type VendorPayload = {
  vendor: { id: string; name: string };
};

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const createdIds: string[] = [];
  let customerId: string | null = null;
  let vehicleId: string | null = null;
  let vendorId: string | null = null;
  const sessions: TestSession[] = [];

  try {
    const owner = await createTestSession(Role.OWNER, `owner-${suffix}`);
    sessions.push(owner);

    const customerName = `Summit Aero Fleet ${suffix}`;
    const contactEmail = `dispatch+${suffix}@example.test`;

    const customerResponse = await createCustomer(
      jsonRequest("http://homebase.local/api/customers", "POST", owner.sessionId, {
        customerType: "business",
        companyName: customerName,
        email: contactEmail,
        phone: "555-0700",
      }),
    );
    await expectStatus(customerResponse, 201, "customer create");
    const customerJson = await readJson<CustomerPayload>(customerResponse);
    customerId = customerJson.customer.id;
    createdIds.push(customerId);
    assert.equal(customerJson.customer.displayName, customerName);

    const contactResponse = await createCustomerContact(
      jsonRequest(
        `http://homebase.local/api/customers/${customerId}/contacts`,
        "POST",
        owner.sessionId,
        {
          firstName: "Harper",
          lastName: "Ellison",
          title: "Fleet Lead",
          email: `harper+${suffix}@example.test`,
          phone: "555-0701",
          isPrimary: true,
        },
      ),
      routeContext(customerId),
    );
    await expectStatus(contactResponse, 201, "customer contact create");
    const contactJson = await readJson<ContactPayload>(contactResponse);
    createdIds.push(contactJson.contact.id);
    assert.equal(contactJson.contact.isPrimary, true);

    const addressResponse = await createCustomerAddress(
      jsonRequest(
        `http://homebase.local/api/customers/${customerId}/addresses`,
        "POST",
        owner.sessionId,
        {
          type: "billing",
          line1: "300 Runway Road",
          city: "Granite Falls",
          state: "wa",
          postalCode: "98252",
          country: "us",
          isPrimary: true,
        },
      ),
      routeContext(customerId),
    );
    await expectStatus(addressResponse, 201, "customer address create");
    const addressJson = await readJson<AddressPayload>(addressResponse);
    createdIds.push(addressJson.address.id);
    assert.equal(addressJson.address.city, "Granite Falls");

    const uniqueVin = `HBSMK${suffix.toUpperCase().padEnd(12, "Z")}`.slice(0, 17);
    const vehicleResponse = await createVehicle(
      jsonRequest("http://homebase.local/api/vehicles", "POST", owner.sessionId, {
        customerId,
        vin: uniqueVin,
        year: 2021,
        make: "Freightliner",
        model: "Cascadia",
        unitNumber: `UNIT-${suffix}`,
        licensePlate: `PLT${suffix.slice(0, 4)}`.toUpperCase(),
        licenseState: "wa",
        color: "White",
        currentMileage: 42_000,
      }),
    );
    await expectStatus(vehicleResponse, 201, "vehicle create");
    const vehicleJson = await readJson<{ vehicle: VehiclePayload["vehicle"] }>(vehicleResponse);
    vehicleId = vehicleJson.vehicle.id;
    createdIds.push(vehicleId);
    assert.equal(vehicleJson.vehicle.normalizedVin, uniqueVin.toUpperCase());

    const mileageResponse = await updateVehicle(
      jsonRequest(`http://homebase.local/api/vehicles/${vehicleId}`, "PATCH", owner.sessionId, {
        currentMileage: 44_250,
        mileageNote: "Post-route reading.",
      }),
      routeContext(vehicleId),
    );
    await expectStatus(mileageResponse, 200, "vehicle mileage update");
    const mileageJson = await readJson<{ vehicle: VehiclePayload["vehicle"]; mileageReading: { id: string } | null }>(
      mileageResponse,
    );
    assert.equal(mileageJson.vehicle.currentMileage, 44_250);
    assert.ok(mileageJson.mileageReading, "mileage reading should be created when mileage changes");

    const noteResponse = await createVehicleNote(
      jsonRequest(
        `http://homebase.local/api/vehicles/${vehicleId}/notes`,
        "POST",
        owner.sessionId,
        {
          type: "service_history",
          body: "Completed scheduled PM at 42k miles.",
        },
      ),
      routeContext(vehicleId),
    );
    await expectStatus(noteResponse, 201, "vehicle note create");
    const noteJson = await readJson<{ note: { id: string } }>(noteResponse);
    createdIds.push(noteJson.note.id);

    const vendorName = `Cascadia Parts Depot ${suffix}`;
    const vendorResponse = await createVendor(
      jsonRequest("http://homebase.local/api/vendors", "POST", owner.sessionId, {
        vendorType: "parts",
        name: vendorName,
        email: `orders+${suffix}@example.test`,
        phone: "555-0710",
      }),
    );
    await expectStatus(vendorResponse, 201, "vendor create");
    const vendorJson = await readJson<VendorPayload>(vendorResponse);
    vendorId = vendorJson.vendor.id;
    createdIds.push(vendorId);

    const vendorContactResponse = await createVendorContact(
      jsonRequest(
        `http://homebase.local/api/vendors/${vendorId}/contacts`,
        "POST",
        owner.sessionId,
        {
          firstName: "Rory",
          lastName: "Nakamura",
          title: "Account Representative",
          email: `rory+${suffix}@example.test`,
          isPrimary: true,
        },
      ),
      routeContext(vendorId),
    );
    await expectStatus(vendorContactResponse, 201, "vendor contact create");
    const vendorContactJson = await readJson<ContactPayload>(vendorContactResponse);
    createdIds.push(vendorContactJson.contact.id);

    const searchResponse = await searchCoreEntities(
      authedRequest(
        `http://homebase.local/api/search/core-entities?q=${encodeURIComponent(suffix)}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(searchResponse, 200, "core entities search");
    const searchJson = await readJson<{
      results: Array<{ type: string; id: string }>;
      counts: { customers: number; contacts: number; vehicles: number; vendors: number; total: number };
    }>(searchResponse);
    const resultTypes = new Set(searchJson.results.map((result) => result.type));
    assert.ok(resultTypes.has("customer"), "search should return customer");
    assert.ok(resultTypes.has("vendor"), "search should return vendor");
    assert.ok(resultTypes.has("vehicle"), "search should return vehicle");
    assert.ok(resultTypes.has("contact"), "search should return contact");

    const customerListResponse = await listCustomers(
      authedRequest(
        `http://homebase.local/api/customers?q=${encodeURIComponent(customerName)}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(customerListResponse, 200, "customer list");
    const customerList = await readJson<{ customers: Array<{ id: string }> }>(customerListResponse);
    assert.ok(customerList.customers.some((customer) => customer.id === customerId));

    const vehicleListResponse = await listVehicles(
      authedRequest(
        `http://homebase.local/api/vehicles?customerId=${customerId}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(vehicleListResponse, 200, "vehicle list");
    const vehicleList = await readJson<{ vehicles: Array<{ id: string }> }>(vehicleListResponse);
    assert.ok(vehicleList.vehicles.some((vehicle) => vehicle.id === vehicleId));

    const vendorListResponse = await listVendors(
      authedRequest(
        `http://homebase.local/api/vendors?q=${encodeURIComponent(vendorName)}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(vendorListResponse, 200, "vendor list");
    const vendorList = await readJson<{ vendors: Array<{ id: string }> }>(vendorListResponse);
    assert.ok(vendorList.vendors.some((vendor) => vendor.id === vendorId));

    const deleteResponse = await deleteCustomer(
      authedRequest(`http://homebase.local/api/customers/${customerId}`, "DELETE", owner.sessionId),
      routeContext(customerId),
    );
    await expectStatus(deleteResponse, 200, "customer delete");

    const postDeleteCustomerResponse = await getCustomer(
      authedRequest(`http://homebase.local/api/customers/${customerId}`, "GET", owner.sessionId),
      routeContext(customerId),
    );
    await expectStatus(postDeleteCustomerResponse, 404, "deleted customer detail");

    const postDeleteVehicleResponse = await listVehicles(
      authedRequest(
        `http://homebase.local/api/vehicles?customerId=${customerId}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(postDeleteVehicleResponse, 200, "vehicle list after customer delete");
    const postDeleteVehicles = await readJson<{ vehicles: Array<{ id: string }> }>(
      postDeleteVehicleResponse,
    );
    assert.ok(
      !postDeleteVehicles.vehicles.some((vehicle) => vehicle.id === vehicleId),
      "vehicles attached to a deleted customer should not appear in the list",
    );

    const postDeleteSearchResponse = await searchCoreEntities(
      authedRequest(
        `http://homebase.local/api/search/core-entities?q=${encodeURIComponent(suffix)}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(postDeleteSearchResponse, 200, "search after customer delete");
    const postDeleteSearch = await readJson<{ results: Array<{ type: string; id: string }> }>(
      postDeleteSearchResponse,
    );
    const customerHits = postDeleteSearch.results.filter((result) => result.type === "customer");
    assert.ok(
      !customerHits.some((result) => result.id === customerId),
      "deleted customer should not appear in search",
    );
    const vehicleHits = postDeleteSearch.results.filter((result) => result.type === "vehicle");
    assert.ok(
      !vehicleHits.some((result) => result.id === vehicleId),
      "vehicle on deleted customer should not appear in search",
    );

    await assertAuditRows([
      ["customer.create", "Customer", customerId],
      ["customer.delete", "Customer", customerId],
      ["contact.create", "Contact", contactJson.contact.id],
      ["address.create", "Address", addressJson.address.id],
      ["vehicle.create", "Vehicle", vehicleId],
      ["vehicle.update", "Vehicle", vehicleId],
      ["vendor.create", "Vendor", vendorId],
      ["contact.create", "Contact", vendorContactJson.contact.id],
    ]);

    console.log("Core entities smoke test: OK");
  } finally {
    await cleanup(createdIds, sessions, customerId, vendorId);
  }
}

function routeContext(id: string) {
  return { params: { id } };
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: authHeaders(sessionId),
  });
}

function jsonRequest(url: string, method: string, sessionId: string | null, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      ...(sessionId ? authHeaders(sessionId) : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "core-entities-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `core-entities-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `core-entities-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "core-entities-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function assertAuditRows(rows: Array<[string, string, string]>) {
  for (const [action, entityType, entityId] of rows) {
    const auditRow = await db.auditLog.findFirst({
      where: { action, entityType, entityId },
    });

    assert.ok(auditRow, `Missing audit row for ${action} ${entityId}`);
  }
}

async function cleanup(
  entityIds: string[],
  sessions: TestSession[],
  customerId: string | null,
  vendorId: string | null,
) {
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({
      where: {
        entityId: { in: entityIds },
      },
    });
  }

  if (customerId) {
    await db.customer.deleteMany({
      where: { id: customerId },
    });
  }

  if (vendorId) {
    await db.vendor.deleteMany({
      where: { id: vendorId },
    });
  }

  if (sessions.length > 0) {
    await db.session.deleteMany({
      where: {
        id: { in: sessions.map((session) => session.sessionId) },
      },
    });
    await db.user.deleteMany({
      where: {
        id: { in: sessions.map((session) => session.userId) },
      },
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
