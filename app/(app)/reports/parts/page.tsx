import { PartsInventoryReportView } from "@/components/reports/PartsInventoryReport";
import { requirePageUser } from "@/lib/core/pageAuth";
import { getPartsInventoryReport } from "@/lib/reports/parts";

export default async function PartsReportsPage() {
  await requirePageUser();
  const report = await getPartsInventoryReport();

  return <PartsInventoryReportView report={report} />;
}
