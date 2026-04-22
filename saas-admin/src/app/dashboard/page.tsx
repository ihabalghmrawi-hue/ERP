import { getAdminFromCookie } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  const admin = getAdminFromCookie()!;
  return <DashboardClient adminName={admin.name} adminEmail={admin.email} />;
}
