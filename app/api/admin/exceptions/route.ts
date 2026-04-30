import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import {
  getExceptionCounts,
  listCustomersWithoutContacts,
  listExpiredPortalTokens,
  listExpiredVideoShareLinks,
  listOpenWorkOrdersWithoutTech,
  listStaleEstimates,
  listStaleQuotes,
} from "@/lib/admin/exceptions";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const searchParams = new URL(request.url).searchParams;
    const type = searchParams.get("type")?.trim() || "summary";

    if (type === "summary") {
      const counts = await getExceptionCounts();
      return NextResponse.json({ counts });
    }

    if (type === "customers_without_contacts") {
      const rows = await listCustomersWithoutContacts();
      return NextResponse.json({ rows });
    }

    if (type === "stale_quotes") {
      const rows = await listStaleQuotes();
      return NextResponse.json({ rows });
    }

    if (type === "stale_estimates") {
      const rows = await listStaleEstimates();
      return NextResponse.json({ rows });
    }

    if (type === "expired_portal_tokens") {
      const rows = await listExpiredPortalTokens();
      return NextResponse.json({ rows });
    }

    if (type === "expired_video_share_links") {
      const rows = await listExpiredVideoShareLinks();
      return NextResponse.json({ rows });
    }

    if (type === "open_work_orders_without_tech") {
      const rows = await listOpenWorkOrdersWithoutTech();
      return NextResponse.json({ rows });
    }

    return NextResponse.json({ error: "Unknown exception type." }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
