import { CloseoutReportView } from "@/components/reports/CloseoutReport";
import { requirePageUser } from "@/lib/core/pageAuth";
import { getCloseoutReport } from "@/lib/reports/closeout";

export default async function CloseoutReportsPage() {
  await requirePageUser();
  const report = await getCloseoutReport();

  return <CloseoutReportView report={report} />;
}
