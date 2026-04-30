import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { emptySalesSearchPayload, searchSalesEntities } from "@/lib/sales/search";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);

    if (!query) {
      return NextResponse.json({
        query,
        ...emptySalesSearchPayload(),
      });
    }

    const payload = await searchSalesEntities(query, user);

    return NextResponse.json({
      query,
      ...payload,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
