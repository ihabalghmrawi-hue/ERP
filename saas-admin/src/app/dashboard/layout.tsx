import { redirect } from "next/navigation";
import { getAdminFromCookie } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = getAdminFromCookie();
  if (!admin) redirect("/login");
  return <>{children}</>;
}
