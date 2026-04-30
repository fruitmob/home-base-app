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
  getSalesCustomerReport,
  type SalesCustomerReport,
} from "@/lib/reports/sales";

function buildSections(report: SalesCustomerReport): CsvReportSection[] {
  return [
    {
      title: "Scope",
      rows: [
        { label: "Report", value: report.title },
        { label: "Scope", value: report.scopeLabel },
        { label: "Description", value: report.description },
      ],
    },
    { title: "Report Windows", rows: report.windows.map((w) => ({ label: w.label, value: w.detail })) },
    { title: "Hero Metrics", rows: dashboardItemsToRows(report.heroMetrics) },
    { title: "Pipeline Metrics", rows: dashboardItemsToRows(report.pipelineMetrics) },
    { title: "Pipeline by Stage", rows: dashboardItemsToRows(report.stageRows) },
    { title: "Stage Age (current stage, updatedAt proxy)", rows: dashboardItemsToRows(report.stageAgeRows) },
    { title: "Oldest Open Opportunities", rows: dashboardItemsToRows(report.oldestOpenRows) },
    { title: "Rep Performance Metrics", rows: dashboardItemsToRows(report.performanceMetrics) },
    { title: "Rep Performance Rows", rows: dashboardItemsToRows(report.performanceRows) },
    { title: "Customer Metrics", rows: dashboardItemsToRows(report.customerMetrics) },
    { title: "Customer Rows", rows: dashboardItemsToRows(report.customerRows) },
  ];
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const report = await getSalesCustomerReport(user);
    const generatedAt = new Date();
    const body = sectionsToCsv(report.title, generatedAt, buildSections(report));
    const filename = csvFilename("sales-performance", generatedAt);

    return csvResponse(body, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
