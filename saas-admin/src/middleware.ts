import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // protect /dashboard and /api/* (except /api/auth/login)
  const isProtected =
    pathname.startsWith("/dashboard") ||
    (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/login"));

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    verifyAdminToken(token);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "الجلسة منتهية" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
