import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { buildCloseoutReportSections, getCloseoutReport } from "@/lib/reports/closeout";
import { pdfFilename } from "@/lib/reports/export";
import { pdfResponse, renderReportPdf } from "@/lib/reports/pdf";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const report = await getCloseoutReport();
    const generatedAt = new Date();
    const bytes = await renderReportPdf(
      report.title,
      generatedAt,
      buildCloseoutReportSections(report),
    );
    const filename = pdfFilename("financial-closeout", generatedAt);

    return pdfResponse(bytes, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
