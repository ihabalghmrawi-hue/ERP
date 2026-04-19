import { NextResponse } from "next/server";
import { loadSaaSData } from "@/lib/server/storage";

export async function GET() {
  const data = await loadSaaSData();
  return NextResponse.json({ companies: data.companies, globalCounters: data.globalCounters });
}
