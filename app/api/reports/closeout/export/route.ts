import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { buildCloseoutReportSections, getCloseoutReport } from "@/lib/reports/closeout";
import { csvFilename, csvResponse, sectionsToCsv } from "@/lib/reports/export";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const report = await getCloseoutReport();
    const generatedAt = new Date();
    const body = sectionsToCsv(report.title, generatedAt, buildCloseoutReportSections(report));
    const filename = csvFilename("financial-closeout", generatedAt);

    return csvResponse(body, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
