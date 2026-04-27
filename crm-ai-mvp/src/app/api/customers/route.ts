import { NextRequest, NextResponse } from "next/server";
import { customers } from "@/lib/mock-db";

export async function GET() {
  return NextResponse.json({ data: customers });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const row = {
    id: `c_${Date.now()}`,
    ...body,
    tags: body.tags ?? ["cold"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customers.push(row);
  return NextResponse.json({ data: row }, { status: 201 });
}
