import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { pdfFilename } from "@/lib/reports/export";
import { pdfResponse, renderReportPdf } from "@/lib/reports/pdf";
import { buildServiceReportSections, getServiceOperationsReport } from "@/lib/reports/service";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const report = await getServiceOperationsReport();
    const generatedAt = new Date();
    const bytes = await renderReportPdf(
      "Service Operations Report",
      generatedAt,
      buildServiceReportSections(report),
    );
    const filename = pdfFilename("service-operations", generatedAt);

    return pdfResponse(bytes, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
