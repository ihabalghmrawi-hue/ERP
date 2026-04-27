import { NextResponse } from "next/server";
import { customers } from "@/lib/mock-db";

export async function GET() {
  const activeLeads = customers.length;
  const hot = customers.filter((c) => c.tags.includes("hot")).length;
  const warm = customers.filter((c) => c.tags.includes("warm")).length;
  const cold = customers.filter((c) => c.tags.includes("cold")).length;

  return NextResponse.json({
    data: {
      kpis: {
        conversionRate: 28,
        activeLeads,
        topPerformingSalesRep: "rep_1",
      },
      leadDistribution: { hot, warm, cold },
      pipeline: {
        lead: 15,
        contacted: 10,
        negotiation: 5,
        closed: 4,
      },
    },
  });
}
