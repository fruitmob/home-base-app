import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DELETE as deleteAddress, PATCH as updateAddress } from "@/app/api/addresses/[id]/route";
import { DELETE as deleteContact, PATCH as updateContact } from "@/app/api/contacts/[id]/route";
import {
  DELETE as deleteVendor,
  GET as getVendor,
  PATCH as updateVendor,
} from "@/app/api/vendors/[id]/route";
import {
  GET as listVendorAddresses,
  POST as createVendorAddress,
} from "@/app/api/vendors/[id]/addresses/route";
import {
  GET as listVendorContacts,
  POST as createVendorContact,
} from "@/app/api/vendors/[id]/contacts/route";
import { GET as listVendors, POST as createVendor } from "@/app/api/vendors/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const csrfToken = "vendor-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type VendorPayload = {
  vendor: {
    id: string;
    vendorType: string;
    name: string;
    email: string | null;
    notes: string | null;
    deletedAt: string | null;
    contacts?: unknown[];
    addresses?: unknown[];
  };
};

type ContactPayload = {
  contact: {
    id: string;
    displayName: string;
    title: string | null;
    isPrimary: boolean;
    deletedAt: string | null;
  };
};

type AddressPayload = {
  address: {
    id: string;
    type: string;
    city: string;
    state: string | null;
    country: string;
    isPrimary: boolean;
    deletedAt: string | null;
  };
};

async function main() {
  const suffix = randomUUID();
  const entityIds: string[] = [];
  const vendorIds: string[] = [];
  const sessions: TestSession[] = [];
  let vendorId: string | null = null;

  try {
    const partsUser = await createTestSession(Role.PARTS, `parts-${suffix}`);
    const salesUser = await createTestSession(Role.SALES_REP, `sales-${suffix}`);
    sessions.push(partsUser, salesUser);

    const unauthenticatedCreate = await createVendor(
      jsonRequest("http://homebase.local/api/vendors", "POST", null, {
        name: "Blocked Vendor",
      }),
    );
    await expectStatus(unauthenticatedCreate, 401, "unauthenticated vendor create");

    const salesCreate = await createVendor(
      jsonRequest("http://homebase.local/api/vendors", "POST", salesUser.sessionId, {
        name: "Blocked Vendor",
      }),
    );
    await expectStatus(salesCreate, 403, "sales vendor create");

    const createVendorResponse = await createVendor(
      jsonRequest("http://homebase.local/api/vendors", "POST", partsUser.sessionId, {
        vendorType: "both",
        name: `Northline Supply ${suffix}`,
        accountNumber: "NL-100",
        email: `PARTS+${suffix}@EXAMPLE.COM`,
        phone: " (555) 010-3000 ",
      }),
    );
    await expectStatus(createVendorResponse, 201, "vendor create");

    const createdVendor = await readJson<VendorPayload>(createVendorResponse);
    vendorId = createdVendor.vendor.id;
    vendorIds.push(vendorId);
    entityIds.push(vendorId);
    assert.equal(createdVendor.vendor.vendorType, "BOTH");
    assert.equal(createdVendor.vendor.name, `Northline Supply ${suffix}`);
    assert.equal(createdVendor.vendor.email, `parts+${suffix}@example.com`);

    const listResponse = await listVendors(
      authedRequest(
        `http://homebase.local/api/vendors?q=${encodeURIComponent(`Northline Supply ${suffix}`)}`,
        "GET",
        partsUser.sessionId,
      ),
    );
    await expectStatus(listResponse, 200, "vendor list");
    const listed = await readJson<{ vendors: Array<{ id: string }> }>(listResponse);
    assert.ok(listed.vendors.some((vendor) => vendor.id === vendorId));

    const firstContactResponse = await createVendorContact(
      jsonRequest(
        `http://homebase.local/api/vendors/${vendorId}/contacts`,
        "POST",
        partsUser.sessionId,
        {
          firstName: "Morgan",
          lastName: "Patel",
          email: `morgan+${suffix}@example.com`,
          isPrimary: true,
        },
      ),
      routeContext(vendorId),
    );
    await expectStatus(firstContactResponse, 201, "first vendor contact create");
    const firstContact = await readJson<ContactPayload>(firstContactResponse);
    entityIds.push(firstContact.contact.id);
    assert.equal(firstContact.contact.displayName, "Morgan Patel");
    assert.equal(firstContact.contact.isPrimary, true);

    const secondContactResponse = await createVendorContact(
      jsonRequest(
        `http://homebase.local/api/vendors/${vendorId}/contacts`,
        "POST",
        partsUser.sessionId,
        {
          firstName: "Taylor",
          lastName: "Quinn",
          email: `taylor+${suffix}@example.com`,
          isPrimary: true,
        },
      ),
      routeContext(vendorId),
    );
    await expectStatus(secondContactResponse, 201, "second vendor contact create");
    const secondContact = await readJson<ContactPayload>(secondContactResponse);
    entityIds.push(secondContact.contact.id);

    const demotedContact = await db.contact.findUnique({ where: { id: firstContact.contact.id } });
    assert.equal(demotedContact?.isPrimary, false);

    const salesContactUpdate = await updateContact(
      jsonRequest(
        `http://homebase.local/api/contacts/${secondContact.contact.id}`,
        "PATCH",
        salesUser.sessionId,
        { title: "Blocked" },
      ),
      routeContext(secondContact.contact.id),
    );
    await expectStatus(salesContactUpdate, 403, "sales vendor contact update");

    const updateContactResponse = await updateContact(
      jsonRequest(
        `http://homebase.local/api/contacts/${secondContact.contact.id}`,
        "PATCH",
        partsUser.sessionId,
        {
          title: "Vendor Account Lead",
          phone: "555-010-3100",
        },
      ),
      routeContext(secondContact.contact.id),
    );
    await expectStatus(updateContactResponse, 200, "vendor contact update");
    const updatedContact = await readJson<ContactPayload>(updateContactResponse);
    assert.equal(updatedContact.contact.title, "Vendor Account Lead");

    const createAddressResponse = await createVendorAddress(
      jsonRequest(
        `http://homebase.local/api/vendors/${vendorId}/addresses`,
        "POST",
        partsUser.sessionId,
        {
          type: "shipping",
          line1: "450 Parts Park",
          city: "Kansas City",
          state: "ks",
          postalCode: "66101",
          country: "us",
          isPrimary: true,
        },
      ),
      routeContext(vendorId),
    );
    await expectStatus(createAddressResponse, 201, "vendor address create");
    const createdAddress = await readJson<AddressPayload>(createAddressResponse);
    entityIds.push(createdAddress.address.id);
    assert.equal(createdAddress.address.type, "SHIPPING");
    assert.equal(createdAddress.address.state, "KS");
    assert.equal(createdAddress.address.country, "US");

    const detailResponse = await getVendor(
      authedRequest(`http://homebase.local/api/vendors/${vendorId}`, "GET", partsUser.sessionId),
      routeContext(vendorId),
    );
    await expectStatus(detailResponse, 200, "vendor detail");
    const detail = await readJson<VendorPayload>(detailResponse);
    assert.equal(detail.vendor.contacts?.length, 2);
    assert.equal(detail.vendor.addresses?.length, 1);

    const updateAddressResponse = await updateAddress(
      jsonRequest(
        `http://homebase.local/api/addresses/${createdAddress.address.id}`,
        "PATCH",
        partsUser.sessionId,
        { city: "Kansas City North" },
      ),
      routeContext(createdAddress.address.id),
    );
    await expectStatus(updateAddressResponse, 200, "vendor address update");
    const updatedAddress = await readJson<AddressPayload>(updateAddressResponse);
    assert.equal(updatedAddress.address.city, "Kansas City North");

    const updateVendorResponse = await updateVendor(
      jsonRequest(`http://homebase.local/api/vendors/${vendorId}`, "PATCH", partsUser.sessionId, {
        notes: "Updated by vendor API smoke test.",
      }),
      routeContext(vendorId),
    );
    await expectStatus(updateVendorResponse, 200, "vendor update");
    const updatedVendor = await readJson<VendorPayload>(updateVendorResponse);
    assert.equal(updatedVendor.vendor.notes, "Updated by vendor API smoke test.");

    const deleteContactResponse = await deleteContact(
      authedRequest(
        `http://homebase.local/api/contacts/${secondContact.contact.id}`,
        "DELETE",
        partsUser.sessionId,
      ),
      routeContext(secondContact.contact.id),
    );
    await expectStatus(deleteContactResponse, 200, "vendor contact delete");
    const deletedContact = await readJson<ContactPayload>(deleteContactResponse);
    assert.ok(deletedContact.contact.deletedAt);

    const contactsAfterDeleteResponse = await listVendorContacts(
      authedRequest(
        `http://homebase.local/api/vendors/${vendorId}/contacts`,
        "GET",
        partsUser.sessionId,
      ),
      routeContext(vendorId),
    );
    await expectStatus(contactsAfterDeleteResponse, 200, "vendor contact list after delete");
    const contactsAfterDelete = await readJson<{ contacts: Array<{ id: string }> }>(
      contactsAfterDeleteResponse,
    );
    assert.ok(!contactsAfterDelete.contacts.some((contact) => contact.id === secondContact.contact.id));

    const deleteAddressResponse = await deleteAddress(
      authedRequest(
        `http://homebase.local/api/addresses/${createdAddress.address.id}`,
        "DELETE",
        partsUser.sessionId,
      ),
      routeContext(createdAddress.address.id),
    );
    await expectStatus(deleteAddressResponse, 200, "vendor address delete");
    const deletedAddress = await readJson<AddressPayload>(deleteAddressResponse);
    assert.ok(deletedAddress.address.deletedAt);

    const addressesAfterDeleteResponse = await listVendorAddresses(
      authedRequest(
        `http://homebase.local/api/vendors/${vendorId}/addresses`,
        "GET",
        partsUser.sessionId,
      ),
      routeContext(vendorId),
    );
    await expectStatus(addressesAfterDeleteResponse, 200, "vendor address list after delete");
    const addressesAfterDelete = await readJson<{ addresses: Array<{ id: string }> }>(
      addressesAfterDeleteResponse,
    );
    assert.ok(!addressesAfterDelete.addresses.some((address) => address.id === createdAddress.address.id));

    const deleteVendorResponse = await deleteVendor(
      authedRequest(`http://homebase.local/api/vendors/${vendorId}`, "DELETE", partsUser.sessionId),
      routeContext(vendorId),
    );
    await expectStatus(deleteVendorResponse, 200, "vendor delete");
    const deletedVendor = await readJson<VendorPayload>(deleteVendorResponse);
    assert.ok(deletedVendor.vendor.deletedAt);

    const getDeletedVendorResponse = await getVendor(
      authedRequest(`http://homebase.local/api/vendors/${vendorId}`, "GET", partsUser.sessionId),
      routeContext(vendorId),
    );
    await expectStatus(getDeletedVendorResponse, 404, "deleted vendor detail");

    await assertAuditRows([
      ["vendor.create", "Vendor", vendorId],
      ["vendor.update", "Vendor", vendorId],
      ["vendor.delete", "Vendor", vendorId],
      ["contact.create", "Contact", firstContact.contact.id],
      ["contact.update", "Contact", secondContact.contact.id],
      ["contact.delete", "Contact", secondContact.contact.id],
      ["address.create", "Address", createdAddress.address.id],
      ["address.update", "Address", createdAddress.address.id],
      ["address.delete", "Address", createdAddress.address.id],
    ]);

    console.log("Vendor API smoke test: OK");
  } finally {
    await cleanup(entityIds, vendorIds, sessions);
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
    "user-agent": "vendor-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `vendor-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `vendor-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "vendor-api-smoke-test",
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

async function cleanup(entityIds: string[], vendorIds: string[], sessions: TestSession[]) {
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({
      where: {
        entityId: { in: entityIds },
      },
    });
  }

  if (vendorIds.length > 0) {
    await db.vendor.deleteMany({
      where: {
        id: { in: vendorIds },
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
