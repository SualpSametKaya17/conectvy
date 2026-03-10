/**
 * POST /api/auth/2fa/verify
 * Login sırasında TOTP kodunu doğrular ve tam oturum açar.
 * Pending cookie gerektirir.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/utils";
import { verifySessionToken, createSessionToken, SESSION_COOKIE, SESSION_DURATION, PENDING_COOKIE } from "@/lib/session";
import { getPool, sql } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { verifyTotpToken } from "@/lib/totp";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_COOKIE)?.value;

  if (!pendingToken) return apiError("Oturum bulunamadı", 401);

  let payload;
  try {
    payload = await verifySessionToken(pendingToken);
    if (!payload.pendingTotp) return apiError("Geçersiz pending oturumu", 401);
  } catch {
    return apiError("Oturum süresi doldu, tekrar giriş yapın", 401);
  }

  const { code } = await req.json();
  if (!code || typeof code !== "string") return apiError("Kod zorunludur", 400);

  // Kullanıcının TOTP secret'ını çek
  const pool = await getPool();
  const result = await pool.request()
    .input("userId", sql.Int, payload.userId)
    .query("SELECT totp_secret, totp_enabled FROM users WHERE id = @userId AND is_active = 1");

  const user = result.recordset[0];
  if (!user || !user.totp_enabled || !user.totp_secret) {
    return apiError("2FA ayarı bulunamadı", 401);
  }

  const secret = decrypt(user.totp_secret);
  const valid  = verifyTotpToken(secret, code);
  if (!valid) return apiError("Geçersiz kod, tekrar deneyin", 401);

  // Tam oturum token'ı oluştur
  const sessionToken = await createSessionToken(payload.userId, payload.username);
  const res = NextResponse.json({ success: true, data: { username: payload.username } });

  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   SESSION_DURATION / 1000,
  });
  // Pending cookie'yi temizle
  res.cookies.delete(PENDING_COOKIE);

  return res;
}
