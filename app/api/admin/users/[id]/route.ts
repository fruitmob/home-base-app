import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { updateAdminUser } from "@/lib/admin/users";
import { HttpError, requireAdmin } from "@/lib/auth";
import { apiErrorResponse, hasField, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdmin(request);
    verifyMutationCsrf(request);

    const body = await readJsonObject(request);
    const role = hasField(body, "role") ? parseRole(body.role) : undefined;
    const isActive = hasField(body, "isActive") ? parseBoolean(body.isActive, "isActive") : undefined;

    if (role === undefined && isActive === undefined) {
      throw new HttpError(400, "Provide at least one user change.");
    }

    const user = await updateAdminUser(params.id, { role, isActive }, actor, request);
    return NextResponse.json({ user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function parseRole(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Role is invalid.");
  }

  const normalized = value.trim().toUpperCase();

  if (!Object.values(Role).includes(normalized as Role)) {
    throw new HttpError(400, "Role is invalid.");
  }

  return normalized as Role;
}

function parseBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${field} must be true or false.`);
  }

  return value;
}
