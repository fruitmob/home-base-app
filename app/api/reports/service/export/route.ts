import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { csvFilename, csvResponse, sectionsToCsv } from "@/lib/reports/export";
import { buildServiceReportSections, getServiceOperationsReport } from "@/lib/reports/service";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const report = await getServiceOperationsReport();
    const generatedAt = new Date();
    const body = sectionsToCsv(
      "Service Operations Report",
      generatedAt,
      buildServiceReportSections(report),
    );
    const filename = csvFilename("service-operations", generatedAt);

    return csvResponse(body, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
