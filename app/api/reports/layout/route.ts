import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";
import { ValidationError } from "@/lib/core/validators";
import {
  type DashboardLayoutRecord,
  type WidgetId,
  REPORTS_HUB_CATALOG,
  loadReportsHubLayout,
  resetReportsHubLayout,
  saveReportsHubLayout,
} from "@/lib/reports/layout";

const CATALOG_IDS = new Set<string>(REPORTS_HUB_CATALOG.map((entry) => entry.id));

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const layout = await loadReportsHubLayout(user.id, user.role);
    return NextResponse.json({ layout });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const body = await readJsonObject(request);
    const layout = parseLayoutPayload(body);
    const saved = await saveReportsHubLayout(user.id, layout);

    return NextResponse.json({ layout: saved });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    await resetReportsHubLayout(user.id);
    const layout = await loadReportsHubLayout(user.id, user.role);

    return NextResponse.json({ layout });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function parseLayoutPayload(body: Record<string, unknown>): DashboardLayoutRecord {
  const order = readWidgetIdArray(body.order, "order");
  const hidden = readWidgetIdArray(body.hidden, "hidden");
  return { order, hidden };
}

function readWidgetIdArray(value: unknown, field: string): WidgetId[] {
  if (!Array.isArray(value)) {
    throw new ValidationError([`${field} must be an array of widget ids.`]);
  }

  const result: WidgetId[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !CATALOG_IDS.has(entry)) {
      throw new ValidationError([`${field} contains an unknown widget id.`]);
    }
    result.push(entry as WidgetId);
  }
  return result;
}
