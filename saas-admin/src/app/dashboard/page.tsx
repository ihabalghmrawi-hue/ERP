export const dynamic = "force-dynamic";

import { getAdminFromCookie } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const admin = (await getAdminFromCookie())!;
  return <DashboardClient adminName={admin.name} adminEmail={admin.email} />;
}
