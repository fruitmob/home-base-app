import { DashboardHome } from "@/components/reports/DashboardHome";
import { requirePageUser } from "@/lib/core/pageAuth";
import { getDashboardSnapshot } from "@/lib/reports/dashboard";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const snapshot = await getDashboardSnapshot(user);

  return <DashboardHome snapshot={snapshot} />;
}
