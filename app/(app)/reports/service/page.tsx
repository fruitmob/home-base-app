import { ServiceOperationsReportView } from "@/components/reports/ServiceOperationsReport";
import { requirePageUser } from "@/lib/core/pageAuth";
import { getServiceOperationsReport } from "@/lib/reports/service";

export default async function ServiceReportsPage() {
  await requirePageUser();
  const report = await getServiceOperationsReport();

  return <ServiceOperationsReportView report={report} />;
}
