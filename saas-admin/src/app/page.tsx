import { redirect } from "next/navigation";
import { getAdminFromCookie } from "@/lib/auth";

export default function Root() {
  const admin = getAdminFromCookie();
  if (admin) redirect("/dashboard");
  redirect("/login");
}
