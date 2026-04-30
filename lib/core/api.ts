import { NextResponse } from "next/server";
import { Prisma, Role } from "@/generated/prisma/client";
import { HttpError, isHttpError, requireRole, type CurrentUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import {
  CASE_WRITE_ROLES,
  CATALOG_WRITE_ROLES,
  CUSTOMER_ENTITY_WRITE_ROLES,
  ESTIMATE_WRITE_ROLES,
  WORK_ORDER_WRITE_ROLES,
  SALES_GOAL_WRITE_ROLES,
  SALES_WRITE_ROLES,
  VENDOR_WRITE_ROLES,
} from "@/lib/core/permissions";
import { ValidationError } from "@/lib/core/validators";

export async function requireCustomerEntityWrite(request: Request) {
  const user = await requireRole(request, CUSTOMER_ENTITY_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export function requireCustomerWrite(request: Request) {
  return requireCustomerEntityWrite(request);
}

export async function requireVendorWrite(request: Request) {
  const user = await requireRole(request, VENDOR_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export async function requireSalesWrite(request: Request) {
  const user = await requireRole(request, SALES_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export async function requireCatalogWrite(request: Request) {
  const user = await requireRole(request, CATALOG_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export async function requireCaseWrite(request: Request) {
  const user = await requireRole(request, CASE_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export async function requireSalesGoalWrite(request: Request) {
  const user = await requireRole(request, SALES_GOAL_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export async function requireWorkOrderWrite(request: Request) {
  const user = await requireRole(request, WORK_ORDER_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export async function requireEstimateWrite(request: Request) {
  const user = await requireRole(request, ESTIMATE_WRITE_ROLES);
  verifyCsrf(request);

  return user;
}

export function verifyMutationCsrf(request: Request) {
  verifyCsrf(request);
}

export function assertCustomerEntityWriteRole(user: CurrentUser) {
  assertRole(user, CUSTOMER_ENTITY_WRITE_ROLES);
}

export function assertVendorWriteRole(user: CurrentUser) {
  assertRole(user, VENDOR_WRITE_ROLES);
}

export function assertSalesWriteRole(user: CurrentUser) {
  assertRole(user, SALES_WRITE_ROLES);
}

export function assertCatalogWriteRole(user: CurrentUser) {
  assertRole(user, CATALOG_WRITE_ROLES);
}

export function assertCaseWriteRole(user: CurrentUser) {
  assertRole(user, CASE_WRITE_ROLES);
}

export function assertSalesGoalWriteRole(user: CurrentUser) {
  assertRole(user, SALES_GOAL_WRITE_ROLES);
}

export function assertWorkOrderWriteRole(user: CurrentUser) {
  assertRole(user, WORK_ORDER_WRITE_ROLES);
}

export function assertEstimateWriteRole(user: CurrentUser) {
  assertRole(user, ESTIMATE_WRITE_ROLES);
}

export async function readJsonObject(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError(["Request body must be a JSON object."]);
  }

  return body as Record<string, unknown>;
}

export function readRequiredStringField(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError([`${field} is required.`]);
  }

  return value.trim();
}

export function hasField(record: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(record, field);
}

export function notFound(message: string): never {
  throw new HttpError(404, message);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}

export function apiErrorResponse(error: unknown) {
  if (isHttpError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, issues: error.issues }, { status: 400 });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A record with those unique fields already exists." },
        { status: 409 },
      );
    }

    if (error.code === "P2003") {
      return NextResponse.json({ error: "Related record was not found." }, { status: 400 });
    }

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record was not found." }, { status: 404 });
    }
  }

  throw error;
}

function assertRole(user: CurrentUser, roles: readonly Role[]) {
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You do not have access to this resource.");
  }
}
