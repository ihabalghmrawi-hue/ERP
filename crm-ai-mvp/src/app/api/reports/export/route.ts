import { NextRequest, NextResponse } from "next/server";
import { customers } from "@/lib/mock-db";
import { computeLeadScore } from "@/lib/ai/scoring";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadStatus = searchParams.get("lead_status");
  const salesRep = searchParams.get("sales_rep");

  const rows = customers
    .map((customer) => {
      const scored = computeLeadScore({
        interactions: [],
        deal: { stage: "lead", engagementLevel: 40 },
        budget: customer.budget,
      });
      return {
        customer_name: customer.name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
        budget: customer.budget,
        lead_score: scored.leadScore,
        lead_status: scored.leadStatus,
        sales_rep: customer.salesRepId,
      };
    })
    .filter((row) => (leadStatus ? row.lead_status === leadStatus : true))
    .filter((row) => (salesRep ? row.sales_rep === salesRep : true));

  return NextResponse.json({
    data: {
      format: "xlsx",
      columns: Object.keys(rows[0] ?? {}),
      rows,
      note: "Use this structured payload with exceljs for final .xlsx file generation.",
    },
  });
}
