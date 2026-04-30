import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { createAdminUser, listAdminUsers, type AdminUserStatusFilter } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  verifyMutationCsrf,
} from "@/lib/core/api";
import { HttpError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const searchParams = new URL(request.url).searchParams;
    const role = parseRole(searchParams.get("role"));
    const status = parseStatus(searchParams.get("status"));
    const query = searchParams.get("q")?.trim() ?? "";
    const take = Number(searchParams.get("take") ?? 200);
    const result = await listAdminUsers({
      query,
      role,
      status,
      take: Number.isFinite(take) ? take : 200,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    verifyMutationCsrf(request);

    const body = await readJsonObject(request);
    const email = readString(body.email, "email");
    const password = readString(body.password, "password", false);
    const role = parseRole(readString(body.role, "role", true));

    if (!role) {
      throw new HttpError(400, "Role is required.");
    }

    const user = await createAdminUser({ email, password, role }, actor, request);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function parseRole(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (!Object.values(Role).includes(normalized as Role)) {
    throw new HttpError(400, "Role is invalid.");
  }

  return normalized as Role;
}

function parseStatus(value: string | null): AdminUserStatusFilter {
  if (!value) {
    return "all";
  }

  if (value === "active" || value === "inactive" || value === "all") {
    return value;
  }

  throw new HttpError(400, "Status filter is invalid.");
}

function readString(value: unknown, field: string, trim = true) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }

  const result = trim ? value.trim() : value;

  if (result === "") {
    throw new HttpError(400, `${field} is required.`);
  }

  return result;
}
