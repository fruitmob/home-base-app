import { NextResponse } from "next/server";
import { listAdminAuditEntries, parseAuditDate } from "@/lib/admin/audit";
import { HttpError, requireAdmin } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const searchParams = new URL(request.url).searchParams;
    const from = searchParams.get("from")?.trim() || undefined;
    const to = searchParams.get("to")?.trim() || undefined;
    const take = Number(searchParams.get("take") ?? 100);

    if (from && !parseAuditDate(from)) {
      throw new HttpError(400, "The from date is invalid.");
    }

    if (to && !parseAuditDate(to)) {
      throw new HttpError(400, "The to date is invalid.");
    }

    const entries = await listAdminAuditEntries({
      query: searchParams.get("q")?.trim() ?? "",
      actorUserId: searchParams.get("actorUserId")?.trim() || undefined,
      entityType: searchParams.get("entityType")?.trim() || undefined,
      action: searchParams.get("action")?.trim() || undefined,
      from,
      to,
      take: Number.isFinite(take) ? take : 100,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
