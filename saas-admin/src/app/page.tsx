export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAdminFromCookie } from "@/lib/auth";

export default async function Root() {
  const admin = await getAdminFromCookie();
  if (admin) redirect("/dashboard");
  redirect("/login");
}
