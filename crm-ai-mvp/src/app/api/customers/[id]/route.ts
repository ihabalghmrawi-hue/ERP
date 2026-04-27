import { NextRequest, NextResponse } from "next/server";
import { customers, interactions } from "@/lib/mock-db";
import { generateInsight } from "@/lib/ai/insights";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const customer = customers.find((c) => c.id === params.id);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customerInteractions = interactions.filter((i) => i.customerId === customer.id);
  const insight = generateInsight({
    customer,
    interactions: customerInteractions,
    deal: { stage: "contacted", engagementLevel: 68 },
  });

  return NextResponse.json({ data: { customer, interactions: customerInteractions, insight } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const index = customers.findIndex((c) => c.id === params.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  customers[index] = { ...customers[index], ...body, updatedAt: new Date().toISOString() };
  return NextResponse.json({ data: customers[index] });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const index = customers.findIndex((c) => c.id === params.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [removed] = customers.splice(index, 1);
  return NextResponse.json({ data: removed });
}
