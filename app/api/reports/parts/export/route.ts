import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import {
  csvFilename,
  csvResponse,
  dashboardItemsToRows,
  sectionsToCsv,
  type CsvReportSection,
} from "@/lib/reports/export";
import {
  getPartsInventoryReport,
  type PartsInventoryReport,
} from "@/lib/reports/parts";

function buildSections(report: PartsInventoryReport): CsvReportSection[] {
  return [
    {
      title: "Scope",
      rows: [
        { label: "Report", value: report.title },
        { label: "Description", value: report.description },
      ],
    },
    {
      title: "Report Windows",
      rows: report.windows.map((w) => ({ label: w.label, value: w.detail })),
    },
    { title: "Hero Metrics", rows: dashboardItemsToRows(report.heroMetrics) },
    { title: "Low Stock Metrics", rows: dashboardItemsToRows(report.lowStockMetrics) },
    { title: "Low Stock Rows", rows: dashboardItemsToRows(report.lowStockRows) },
    { title: "Turn Metrics", rows: dashboardItemsToRows(report.turnMetrics) },
    { title: "Turn Rows", rows: dashboardItemsToRows(report.turnRows) },
    { title: "Dead Stock Metrics", rows: dashboardItemsToRows(report.deadStockMetrics) },
    { title: "Dead Stock Rows", rows: dashboardItemsToRows(report.deadStockRows) },
    { title: "Vendor Responsiveness Metrics", rows: dashboardItemsToRows(report.vendorMetrics) },
    { title: "Vendor Responsiveness Rows", rows: dashboardItemsToRows(report.vendorRows) },
  ];
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const report = await getPartsInventoryReport();
    const generatedAt = new Date();
    const body = sectionsToCsv(report.title, generatedAt, buildSections(report));
    const filename = csvFilename("parts-inventory", generatedAt);

    return csvResponse(body, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
