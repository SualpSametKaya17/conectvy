import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Oturum gerektirmeyen yollar
const PUBLIC_PREFIXES = ["/login", "/setup", "/db-config", "/api/auth", "/api/db-config"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isApi    = pathname.startsWith("/api/");

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Token yok
  if (!token) {
    if (isPublic) return NextResponse.next();
    if (isApi)    return NextResponse.json({ success: false, error: "Oturum açılmamış" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Token var, doğrula
  try {
    await verifySessionToken(token);

    // Giriş yapmış biri /login veya /setup'a gitmeye çalışıyorsa dashboard'a yönlendir
    if (pathname === "/login" || pathname === "/setup") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  } catch {
    // Token geçersiz — çerezi temizle
    const res = isApi
      ? NextResponse.json({ success: false, error: "Oturum geçersiz" }, { status: 401 })
      : isPublic
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/login", request.url));

    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
