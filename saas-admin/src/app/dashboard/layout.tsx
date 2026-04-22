export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAdminFromCookie } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminFromCookie();
  if (!admin) redirect("/login");
  return <>{children}</>;
}
