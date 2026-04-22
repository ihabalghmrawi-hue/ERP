export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAdminFromCookie } from "@/lib/auth";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const admin = await getAdminFromCookie();
  if (!admin) redirect("/login");
  return <DashboardClient adminName={admin.name} adminEmail={admin.email} />;
}
