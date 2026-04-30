import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const REPORTS_HUB_SCOPE = "reports-hub";

export type WidgetId =
  | "service-ops"
  | "sales-pipeline"
  | "parts-inventory"
  | "financial-closeout"
  | "quality-risk";

export type WidgetCatalogEntry = {
  id: WidgetId;
  title: string;
  description: string;
};

export const REPORTS_HUB_CATALOG: WidgetCatalogEntry[] = [
  {
    id: "service-ops",
    title: "Service Operations",
    description: "WIP flow, aging pressure, staffing gaps, and technician readiness.",
  },
  {
    id: "sales-pipeline",
    title: "Sales Pipeline",
    description: "Pipeline mix, won-vs-goal momentum, overdue follow-ups, and customer growth pressure.",
  },
  {
    id: "parts-inventory",
    title: "Parts & Inventory",
    description: "Stock pressure, reserved inventory, and the last 30 days of movement.",
  },
  {
    id: "financial-closeout",
    title: "Financial Closeout",
    description: "Ready-to-bill queue, approved estimate and change-order totals, and warranty recovery.",
  },
  {
    id: "quality-risk",
    title: "Quality & Risk",
    description: "Inspection backlog, warranty exposure, and cross-module exception pressure.",
  },
];

const CATALOG_IDS: WidgetId[] = REPORTS_HUB_CATALOG.map((entry) => entry.id);
const CATALOG_ID_SET = new Set<string>(CATALOG_IDS);

export type DashboardLayoutRecord = {
  order: WidgetId[];
  hidden: WidgetId[];
};

export function getDefaultReportsHubLayout(role: Role): DashboardLayoutRecord {
  const order = [...CATALOG_IDS];
  const hidden = defaultHiddenForRole(role);
  return { order, hidden };
}

function defaultHiddenForRole(role: Role): WidgetId[] {
  switch (role) {
    case Role.TECH:
    case Role.PARTS:
    case Role.INSPECTOR:
      return ["sales-pipeline"];
    case Role.SALES_REP:
    case Role.SALES_MANAGER:
      return ["parts-inventory"];
    default:
      return [];
  }
}

export async function loadReportsHubLayout(
  userId: string,
  role: Role,
): Promise<DashboardLayoutRecord> {
  const record = await db.dashboardLayout.findUnique({
    where: {
      userId_scope: {
        userId,
        scope: REPORTS_HUB_SCOPE,
      },
    },
  });

  if (!record) {
    return getDefaultReportsHubLayout(role);
  }

  const storedOrder = normalizeWidgetIdArray(record.widgetOrder);
  const storedHidden = normalizeWidgetIdArray(record.hiddenWidgets);
  return mergeWithCatalog(storedOrder, storedHidden);
}

export async function saveReportsHubLayout(
  userId: string,
  layout: DashboardLayoutRecord,
): Promise<DashboardLayoutRecord> {
  const sanitized = mergeWithCatalog(layout.order, layout.hidden);

  await db.dashboardLayout.upsert({
    where: {
      userId_scope: {
        userId,
        scope: REPORTS_HUB_SCOPE,
      },
    },
    create: {
      userId,
      scope: REPORTS_HUB_SCOPE,
      widgetOrder: sanitized.order,
      hiddenWidgets: sanitized.hidden,
    },
    update: {
      widgetOrder: sanitized.order,
      hiddenWidgets: sanitized.hidden,
    },
  });

  return sanitized;
}

export async function resetReportsHubLayout(userId: string): Promise<void> {
  await db.dashboardLayout.deleteMany({
    where: {
      userId,
      scope: REPORTS_HUB_SCOPE,
    },
  });
}

function mergeWithCatalog(
  order: WidgetId[],
  hidden: WidgetId[],
): DashboardLayoutRecord {
  const seen = new Set<WidgetId>();
  const mergedOrder: WidgetId[] = [];

  for (const id of order) {
    if (CATALOG_ID_SET.has(id) && !seen.has(id)) {
      mergedOrder.push(id);
      seen.add(id);
    }
  }

  for (const id of CATALOG_IDS) {
    if (!seen.has(id)) {
      mergedOrder.push(id);
      seen.add(id);
    }
  }

  const mergedHidden = Array.from(
    new Set(hidden.filter((id): id is WidgetId => CATALOG_ID_SET.has(id))),
  );

  return { order: mergedOrder, hidden: mergedHidden };
}

function normalizeWidgetIdArray(value: unknown): WidgetId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: WidgetId[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && CATALOG_ID_SET.has(entry)) {
      result.push(entry as WidgetId);
    }
  }
  return result;
}
