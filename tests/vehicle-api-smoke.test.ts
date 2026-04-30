import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DELETE as deleteVehicle,
  GET as getVehicle,
  PATCH as updateVehicle,
} from "@/app/api/vehicles/[id]/route";
import {
  GET as listMileageReadings,
  POST as createMileageReading,
} from "@/app/api/vehicles/[id]/mileage-readings/route";
import {
  GET as listVehicleNotes,
  POST as createVehicleNote,
} from "@/app/api/vehicles/[id]/notes/route";
import { GET as listVehicles, POST as createVehicle } from "@/app/api/vehicles/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const csrfToken = "vehicle-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type VehiclePayload = {
  vehicle: {
    id: string;
    customerId: string;
    vin: string | null;
    normalizedVin: string | null;
    make: string | null;
    model: string | null;
    currentMileage: number | null;
    deletedAt: string | null;
    customer?: { id: string; displayName: string };
    vehicleNotes?: unknown[];
    mileageReadings?: unknown[];
  };
  mileageReading?: MileageReadingPayload["mileageReading"] | null;
};

type VehicleListPayload = {
  vehicles: Array<VehiclePayload["vehicle"]>;
};

type VehicleNotePayload = {
  note: {
    id: string;
    vehicleId: string;
    type: string;
    body: string;
    authorUserId: string | null;
  };
};

type MileageReadingPayload = {
  mileageReading: {
    id: string;
    vehicleId: string;
    value: number;
    source: string;
    note: string | null;
    recordedByUserId: string | null;
  };
  vehicle: VehiclePayload["vehicle"];
};

async function main() {
  const suffix = randomUUID();
  const vin = randomVin();
  const entityIds: string[] = [];
  const customerIds: string[] = [];
  const sessions: TestSession[] = [];

  try {
    const owner = await createTestSession(Role.OWNER, `owner-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(owner, viewer);

    const customer = await db.customer.create({
      data: {
        customerType: "BUSINESS",
        displayName: `Blue Ridge Rescue ${suffix}`,
        companyName: `Blue Ridge Rescue ${suffix}`,
      },
    });
    const deletedCustomer = await db.customer.create({
      data: {
        customerType: "BUSINESS",
        displayName: `Deleted Fleet ${suffix}`,
        companyName: `Deleted Fleet ${suffix}`,
        deletedAt: new Date(),
      },
    });
    customerIds.push(customer.id, deletedCustomer.id);

    const unauthenticatedCreate = await createVehicle(
      jsonRequest("http://homebase.local/api/vehicles", "POST", null, {
        customerId: customer.id,
        vin,
      }),
    );
    await expectStatus(unauthenticatedCreate, 401, "unauthenticated vehicle create");

    const readOnlyCreate = await createVehicle(
      jsonRequest("http://homebase.local/api/vehicles", "POST", viewer.sessionId, {
        customerId: customer.id,
        vin,
      }),
    );
    await expectStatus(readOnlyCreate, 403, "read-only vehicle create");

    const deletedCustomerCreate = await createVehicle(
      jsonRequest("http://homebase.local/api/vehicles", "POST", owner.sessionId, {
        customerId: deletedCustomer.id,
        vin,
      }),
    );
    await expectStatus(deletedCustomerCreate, 404, "deleted customer vehicle create");

    const createVehicleResponse = await createVehicle(
      jsonRequest("http://homebase.local/api/vehicles", "POST", owner.sessionId, {
        customerId: customer.id,
        vin: spacedVin(vin.toLowerCase()),
        year: 2024,
        make: "Ford",
        model: "Transit",
        unitNumber: "BR-14",
        licensePlate: " br 014 ",
        licenseState: "mo",
        currentMileage: 1200,
        mileageSource: "intake",
        mileageNote: "Initial intake reading",
      }),
    );
    await expectStatus(createVehicleResponse, 201, "vehicle create");

    const created = await readJson<VehiclePayload>(createVehicleResponse);
    const vehicleId = created.vehicle.id;
    entityIds.push(vehicleId);
    assert.equal(created.vehicle.normalizedVin, vin);
    assert.equal(created.vehicle.currentMileage, 1200);
    assert.equal(created.mileageReading?.value, 1200);
    assert.equal(created.mileageReading?.source, "intake");
    if (created.mileageReading) {
      entityIds.push(created.mileageReading.id);
    }

    const duplicateVinResponse = await createVehicle(
      jsonRequest("http://homebase.local/api/vehicles", "POST", owner.sessionId, {
        customerId: customer.id,
        vin,
      }),
    );
    await expectStatus(duplicateVinResponse, 409, "duplicate VIN create");

    const listResponse = await listVehicles(
      authedRequest(
        `http://homebase.local/api/vehicles?q=${encodeURIComponent("BR-14")}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(listResponse, 200, "vehicle list");
    const listed = await readJson<VehicleListPayload>(listResponse);
    assert.ok(listed.vehicles.some((vehicle) => vehicle.id === vehicleId));

    const detailResponse = await getVehicle(
      authedRequest(`http://homebase.local/api/vehicles/${vehicleId}`, "GET", owner.sessionId),
      routeContext(vehicleId),
    );
    await expectStatus(detailResponse, 200, "vehicle detail");
    const detail = await readJson<VehiclePayload>(detailResponse);
    assert.equal(detail.vehicle.customer?.id, customer.id);
    assert.equal(detail.vehicle.mileageReadings?.length, 1);

    const updateResponse = await updateVehicle(
      jsonRequest(`http://homebase.local/api/vehicles/${vehicleId}`, "PATCH", owner.sessionId, {
        color: "White",
        currentMileage: 1305,
        mileageSource: "odometer",
        mileageNote: "Updated after inspection",
      }),
      routeContext(vehicleId),
    );
    await expectStatus(updateResponse, 200, "vehicle update");
    const updated = await readJson<VehiclePayload>(updateResponse);
    assert.equal(updated.vehicle.currentMileage, 1305);
    assert.equal(updated.mileageReading?.value, 1305);
    assert.equal(updated.mileageReading?.source, "odometer");
    if (updated.mileageReading) {
      entityIds.push(updated.mileageReading.id);
    }

    const moveVehicleResponse = await updateVehicle(
      jsonRequest(`http://homebase.local/api/vehicles/${vehicleId}`, "PATCH", owner.sessionId, {
        customerId: deletedCustomer.id,
      }),
      routeContext(vehicleId),
    );
    await expectStatus(moveVehicleResponse, 400, "vehicle customer move");

    const noteResponse = await createVehicleNote(
      jsonRequest(
        `http://homebase.local/api/vehicles/${vehicleId}/notes`,
        "POST",
        owner.sessionId,
        {
          type: "warning",
          body: "Check rear compartment door before delivery.",
        },
      ),
      routeContext(vehicleId),
    );
    await expectStatus(noteResponse, 201, "vehicle note create");
    const note = await readJson<VehicleNotePayload>(noteResponse);
    entityIds.push(note.note.id);
    assert.equal(note.note.type, "WARNING");
    assert.equal(note.note.authorUserId, owner.userId);

    const notesResponse = await listVehicleNotes(
      authedRequest(`http://homebase.local/api/vehicles/${vehicleId}/notes`, "GET", owner.sessionId),
      routeContext(vehicleId),
    );
    await expectStatus(notesResponse, 200, "vehicle note list");
    const notes = await readJson<{ notes: Array<{ id: string }> }>(notesResponse);
    assert.ok(notes.notes.some((existingNote) => existingNote.id === note.note.id));

    const mileageResponse = await createMileageReading(
      jsonRequest(
        `http://homebase.local/api/vehicles/${vehicleId}/mileage-readings`,
        "POST",
        owner.sessionId,
        {
          value: 1410,
          source: "manual",
          note: "Manual reading from dashboard",
        },
      ),
      routeContext(vehicleId),
    );
    await expectStatus(mileageResponse, 201, "mileage reading create");
    const mileage = await readJson<MileageReadingPayload>(mileageResponse);
    entityIds.push(mileage.mileageReading.id);
    assert.equal(mileage.mileageReading.value, 1410);
    assert.equal(mileage.vehicle.currentMileage, 1410);

    const mileageListResponse = await listMileageReadings(
      authedRequest(
        `http://homebase.local/api/vehicles/${vehicleId}/mileage-readings`,
        "GET",
        owner.sessionId,
      ),
      routeContext(vehicleId),
    );
    await expectStatus(mileageListResponse, 200, "mileage reading list");
    const mileageList = await readJson<{ mileageReadings: Array<{ id: string }> }>(
      mileageListResponse,
    );
    assert.equal(mileageList.mileageReadings.length, 3);

    const deleteResponse = await deleteVehicle(
      authedRequest(`http://homebase.local/api/vehicles/${vehicleId}`, "DELETE", owner.sessionId),
      routeContext(vehicleId),
    );
    await expectStatus(deleteResponse, 200, "vehicle delete");
    const deleted = await readJson<VehiclePayload>(deleteResponse);
    assert.ok(deleted.vehicle.deletedAt);

    const getDeletedResponse = await getVehicle(
      authedRequest(`http://homebase.local/api/vehicles/${vehicleId}`, "GET", owner.sessionId),
      routeContext(vehicleId),
    );
    await expectStatus(getDeletedResponse, 404, "deleted vehicle detail");

    const listAfterDeleteResponse = await listVehicles(
      authedRequest(
        `http://homebase.local/api/vehicles?customerId=${customer.id}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(listAfterDeleteResponse, 200, "vehicle list after delete");
    const listAfterDelete = await readJson<VehicleListPayload>(listAfterDeleteResponse);
    assert.ok(!listAfterDelete.vehicles.some((vehicle) => vehicle.id === vehicleId));

    await assertAuditRows([
      ["vehicle.create", "Vehicle", vehicleId],
      ["vehicle.update", "Vehicle", vehicleId],
      ["vehicle.delete", "Vehicle", vehicleId],
      ["vehicleNote.create", "VehicleNote", note.note.id],
      ["vehicleMileage.create", "VehicleMileageReading", created.mileageReading?.id ?? ""],
      ["vehicleMileage.create", "VehicleMileageReading", updated.mileageReading?.id ?? ""],
      ["vehicleMileage.create", "VehicleMileageReading", mileage.mileageReading.id],
    ]);

    console.log("Vehicle API smoke test: OK");
  } finally {
    await cleanup(entityIds, customerIds, sessions);
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
    "user-agent": "vehicle-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `vehicle-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `vehicle-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "vehicle-api-smoke-test",
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
    assert.ok(entityId, `Missing entity id for ${action}`);

    const auditRow = await db.auditLog.findFirst({
      where: { action, entityType, entityId },
    });

    assert.ok(auditRow, `Missing audit row for ${action} ${entityId}`);
  }
}

function randomVin() {
  return randomUUID().replace(/-/g, "").toUpperCase().slice(0, 17);
}

function spacedVin(vin: string) {
  return `${vin.slice(0, 3)} ${vin.slice(3, 9)} ${vin.slice(9)}`;
}

async function cleanup(entityIds: string[], customerIds: string[], sessions: TestSession[]) {
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({
      where: {
        entityId: { in: entityIds },
      },
    });
  }

  if (customerIds.length > 0) {
    await db.customer.deleteMany({
      where: {
        id: { in: customerIds },
      },
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
