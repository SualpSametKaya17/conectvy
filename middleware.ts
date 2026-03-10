import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE, PENDING_COOKIE } from "@/lib/session";

// Oturum gerektirmeyen yollar
const PUBLIC_PREFIXES = ["/login", "/setup", "/db-config", "/api/auth", "/api/db-config"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isApi    = pathname.startsWith("/api/");

  const token        = request.cookies.get(SESSION_COOKIE)?.value;
  const pendingToken = request.cookies.get(PENDING_COOKIE)?.value;

  // ─── Tam oturum token'ı ────────────────────────────────────────────────────
  if (token) {
    try {
      const payload = await verifySessionToken(token);

      // pendingTotp=true olan bir tam-session token'ı reddediyoruz (güvenlik)
      if (payload.pendingTotp) throw new Error("Geçersiz tam oturum");

      // Giriş yapmış biri /login veya /setup'a giderse dashboard'a yönlendir
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

  // ─── Bekleyen (pending) TOTP token'ı ──────────────────────────────────────
  if (pendingToken) {
    try {
      const payload = await verifySessionToken(pendingToken);
      if (!payload.pendingTotp) throw new Error("Geçersiz pending token");

      // Sadece 2FA doğrulama sayfasına ve ilgili API'ye izin ver
      const allow = pathname.startsWith("/login/2fa") || pathname === "/api/auth/2fa/verify";
      if (allow) return NextResponse.next();

      // Diğer herkesi 2FA sayfasına yönlendir
      return NextResponse.redirect(new URL("/login/2fa", request.url));
    } catch {
      // Pending token geçersiz — temizle ve login'e gönder
      const res = NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete(PENDING_COOKIE);
      return res;
    }
  }

  // ─── Token yok ────────────────────────────────────────────────────────────
  if (isPublic) return NextResponse.next();
  if (isApi)    return NextResponse.json({ success: false, error: "Oturum açılmamış" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
