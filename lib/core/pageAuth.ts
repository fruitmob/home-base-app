import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { getCurrentUserFromSessionId } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";
import { canAccessAdmin } from "@/lib/core/permissions";

export async function requireOwnerPageUser() {
  return requirePageRole([Role.OWNER]);
}

export async function requirePageUser() {
  const sessionId = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = await getCurrentUserFromSessionId(sessionId);

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requirePageRole(roles: readonly Role[]) {
  const user = await requirePageUser();

  if (!roles.includes(user.role)) {
    redirect("/");
  }

  return user;
}

export async function requireAdminPageUser() {
  const user = await requirePageUser();

  if (!canAccessAdmin(user.role)) {
    redirect("/");
  }

  return user;
}
