import { SalesPerformanceReportView } from "@/components/reports/SalesPerformanceReport";
import { requirePageUser } from "@/lib/core/pageAuth";
import { getSalesCustomerReport } from "@/lib/reports/sales";

export default async function SalesReportsPage() {
  const user = await requirePageUser();
  const report = await getSalesCustomerReport(user);

  return <SalesPerformanceReportView report={report} />;
}
