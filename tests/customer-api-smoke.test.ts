import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DELETE as deleteAddress, PATCH as updateAddress } from "@/app/api/addresses/[id]/route";
import { DELETE as deleteContact, PATCH as updateContact } from "@/app/api/contacts/[id]/route";
import {
  DELETE as deleteCustomer,
  GET as getCustomer,
  PATCH as updateCustomer,
} from "@/app/api/customers/[id]/route";
import {
  GET as listCustomerAddresses,
  POST as createCustomerAddress,
} from "@/app/api/customers/[id]/addresses/route";
import {
  GET as listCustomerContacts,
  POST as createCustomerContact,
} from "@/app/api/customers/[id]/contacts/route";
import { GET as listCustomers, POST as createCustomer } from "@/app/api/customers/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const csrfToken = "customer-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type CustomerPayload = {
  customer: {
    id: string;
    displayName: string;
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
  const sessions: TestSession[] = [];
  let customerId: string | null = null;

  try {
    const owner = await createTestSession(Role.OWNER, `owner-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(owner, viewer);

    const unauthenticatedCreate = await createCustomer(
      jsonRequest("http://homebase.local/api/customers", "POST", null, {
        companyName: "Blocked Customer",
      }),
    );
    await expectStatus(unauthenticatedCreate, 401, "unauthenticated customer create");

    const readOnlyCreate = await createCustomer(
      jsonRequest("http://homebase.local/api/customers", "POST", viewer.sessionId, {
        companyName: "Blocked Customer",
      }),
    );
    await expectStatus(readOnlyCreate, 403, "read-only customer create");

    const createCustomerResponse = await createCustomer(
      jsonRequest("http://homebase.local/api/customers", "POST", owner.sessionId, {
        customerType: "business",
        companyName: `Summit Fleet ${suffix}`,
        email: `DISPATCH+${suffix}@EXAMPLE.COM`,
        phone: " (555) 010-1000 ",
      }),
    );
    await expectStatus(createCustomerResponse, 201, "customer create");

    const createdCustomer = await readJson<CustomerPayload>(createCustomerResponse);
    customerId = createdCustomer.customer.id;
    entityIds.push(customerId);
    assert.equal(createdCustomer.customer.displayName, `Summit Fleet ${suffix}`);
    assert.equal(createdCustomer.customer.email, `dispatch+${suffix}@example.com`);

    const listResponse = await listCustomers(
      authedRequest(
        `http://homebase.local/api/customers?q=${encodeURIComponent(`Summit Fleet ${suffix}`)}`,
        "GET",
        owner.sessionId,
      ),
    );
    await expectStatus(listResponse, 200, "customer list");
    const listed = await readJson<{ customers: Array<{ id: string }> }>(listResponse);
    assert.ok(listed.customers.some((customer) => customer.id === customerId));

    const firstContactResponse = await createCustomerContact(
      jsonRequest(
        `http://homebase.local/api/customers/${customerId}/contacts`,
        "POST",
        owner.sessionId,
        {
          firstName: "Avery",
          lastName: "Morgan",
          email: `avery+${suffix}@example.com`,
          isPrimary: true,
        },
      ),
      routeContext(customerId),
    );
    await expectStatus(firstContactResponse, 201, "first contact create");
    const firstContact = await readJson<ContactPayload>(firstContactResponse);
    entityIds.push(firstContact.contact.id);
    assert.equal(firstContact.contact.displayName, "Avery Morgan");
    assert.equal(firstContact.contact.isPrimary, true);

    const secondContactResponse = await createCustomerContact(
      jsonRequest(
        `http://homebase.local/api/customers/${customerId}/contacts`,
        "POST",
        owner.sessionId,
        {
          firstName: "Jordan",
          lastName: "Lee",
          email: `jordan+${suffix}@example.com`,
          isPrimary: true,
        },
      ),
      routeContext(customerId),
    );
    await expectStatus(secondContactResponse, 201, "second contact create");
    const secondContact = await readJson<ContactPayload>(secondContactResponse);
    entityIds.push(secondContact.contact.id);

    const demotedContact = await db.contact.findUnique({ where: { id: firstContact.contact.id } });
    assert.equal(demotedContact?.isPrimary, false);

    const updateContactResponse = await updateContact(
      jsonRequest(
        `http://homebase.local/api/contacts/${secondContact.contact.id}`,
        "PATCH",
        owner.sessionId,
        {
          title: "Fleet Coordinator",
          phone: "555-010-2000",
        },
      ),
      routeContext(secondContact.contact.id),
    );
    await expectStatus(updateContactResponse, 200, "contact update");
    const updatedContact = await readJson<ContactPayload>(updateContactResponse);
    assert.equal(updatedContact.contact.title, "Fleet Coordinator");

    const createAddressResponse = await createCustomerAddress(
      jsonRequest(
        `http://homebase.local/api/customers/${customerId}/addresses`,
        "POST",
        owner.sessionId,
        {
          type: "billing",
          line1: "100 Service Lane",
          city: "Springfield",
          state: "mo",
          postalCode: "65806",
          country: "us",
          isPrimary: true,
        },
      ),
      routeContext(customerId),
    );
    await expectStatus(createAddressResponse, 201, "address create");
    const createdAddress = await readJson<AddressPayload>(createAddressResponse);
    entityIds.push(createdAddress.address.id);
    assert.equal(createdAddress.address.type, "BILLING");
    assert.equal(createdAddress.address.state, "MO");
    assert.equal(createdAddress.address.country, "US");

    const detailResponse = await getCustomer(
      authedRequest(`http://homebase.local/api/customers/${customerId}`, "GET", owner.sessionId),
      routeContext(customerId),
    );
    await expectStatus(detailResponse, 200, "customer detail");
    const detail = await readJson<CustomerPayload>(detailResponse);
    assert.equal(detail.customer.contacts?.length, 2);
    assert.equal(detail.customer.addresses?.length, 1);

    const updateAddressResponse = await updateAddress(
      jsonRequest(
        `http://homebase.local/api/addresses/${createdAddress.address.id}`,
        "PATCH",
        owner.sessionId,
        { city: "New Springfield" },
      ),
      routeContext(createdAddress.address.id),
    );
    await expectStatus(updateAddressResponse, 200, "address update");
    const updatedAddress = await readJson<AddressPayload>(updateAddressResponse);
    assert.equal(updatedAddress.address.city, "New Springfield");

    const updateCustomerResponse = await updateCustomer(
      jsonRequest(
        `http://homebase.local/api/customers/${customerId}`,
        "PATCH",
        owner.sessionId,
        { notes: "Updated by customer API smoke test." },
      ),
      routeContext(customerId),
    );
    await expectStatus(updateCustomerResponse, 200, "customer update");
    const updatedCustomer = await readJson<CustomerPayload>(updateCustomerResponse);
    assert.equal(updatedCustomer.customer.notes, "Updated by customer API smoke test.");

    const deleteContactResponse = await deleteContact(
      authedRequest(
        `http://homebase.local/api/contacts/${secondContact.contact.id}`,
        "DELETE",
        owner.sessionId,
      ),
      routeContext(secondContact.contact.id),
    );
    await expectStatus(deleteContactResponse, 200, "contact delete");
    const deletedContact = await readJson<ContactPayload>(deleteContactResponse);
    assert.ok(deletedContact.contact.deletedAt);

    const contactsAfterDeleteResponse = await listCustomerContacts(
      authedRequest(
        `http://homebase.local/api/customers/${customerId}/contacts`,
        "GET",
        owner.sessionId,
      ),
      routeContext(customerId),
    );
    await expectStatus(contactsAfterDeleteResponse, 200, "contact list after delete");
    const contactsAfterDelete = await readJson<{ contacts: Array<{ id: string }> }>(
      contactsAfterDeleteResponse,
    );
    assert.ok(!contactsAfterDelete.contacts.some((contact) => contact.id === secondContact.contact.id));

    const deleteAddressResponse = await deleteAddress(
      authedRequest(
        `http://homebase.local/api/addresses/${createdAddress.address.id}`,
        "DELETE",
        owner.sessionId,
      ),
      routeContext(createdAddress.address.id),
    );
    await expectStatus(deleteAddressResponse, 200, "address delete");
    const deletedAddress = await readJson<AddressPayload>(deleteAddressResponse);
    assert.ok(deletedAddress.address.deletedAt);

    const addressesAfterDeleteResponse = await listCustomerAddresses(
      authedRequest(
        `http://homebase.local/api/customers/${customerId}/addresses`,
        "GET",
        owner.sessionId,
      ),
      routeContext(customerId),
    );
    await expectStatus(addressesAfterDeleteResponse, 200, "address list after delete");
    const addressesAfterDelete = await readJson<{ addresses: Array<{ id: string }> }>(
      addressesAfterDeleteResponse,
    );
    assert.ok(!addressesAfterDelete.addresses.some((address) => address.id === createdAddress.address.id));

    const deleteCustomerResponse = await deleteCustomer(
      authedRequest(`http://homebase.local/api/customers/${customerId}`, "DELETE", owner.sessionId),
      routeContext(customerId),
    );
    await expectStatus(deleteCustomerResponse, 200, "customer delete");
    const deletedCustomer = await readJson<CustomerPayload>(deleteCustomerResponse);
    assert.ok(deletedCustomer.customer.deletedAt);

    const getDeletedCustomerResponse = await getCustomer(
      authedRequest(`http://homebase.local/api/customers/${customerId}`, "GET", owner.sessionId),
      routeContext(customerId),
    );
    await expectStatus(getDeletedCustomerResponse, 404, "deleted customer detail");

    await assertAuditRows([
      ["customer.create", "Customer", customerId],
      ["customer.update", "Customer", customerId],
      ["customer.delete", "Customer", customerId],
      ["contact.create", "Contact", firstContact.contact.id],
      ["contact.update", "Contact", secondContact.contact.id],
      ["contact.delete", "Contact", secondContact.contact.id],
      ["address.create", "Address", createdAddress.address.id],
      ["address.update", "Address", createdAddress.address.id],
      ["address.delete", "Address", createdAddress.address.id],
    ]);

    console.log("Customer API smoke test: OK");
  } finally {
    await cleanup(entityIds, sessions, customerId);
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
    "user-agent": "customer-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `customer-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `customer-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "customer-api-smoke-test",
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

async function cleanup(entityIds: string[], sessions: TestSession[], customerId: string | null) {
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
