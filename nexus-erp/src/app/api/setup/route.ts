import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { setupKey } = await req.json();

  const secret = process.env.SETUP_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "لم يتم تعيين مفتاح الإعداد في إعدادات الخادم" }, { status: 500 });
  }

  if (!setupKey || setupKey !== secret) {
    return NextResponse.json({ error: "مفتاح الإعداد غير صحيح" }, { status: 403 });
  }

  return NextResponse.json({ valid: true });
}
