import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";
import { verifyPassword } from "@/lib/crypto";
import {
  createSessionToken, createPendingToken,
  SESSION_COOKIE, SESSION_DURATION,
  PENDING_COOKIE, PENDING_DURATION,
} from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) return apiError("Kullanıcı adı ve şifre zorunludur", 400);

    const pool   = await getPool();
    const result = await pool.request()
      .input("username", sql.NVarChar, username)
      .query(`
        SELECT id, username, password_hash, is_active, totp_enabled, login_count
        FROM users
        WHERE username = @username
      `);

    const user = result.recordset[0];
    if (!user || !user.is_active) return apiError("Kullanıcı adı veya şifre hatalı", 401);
    if (!user.password_hash)      return apiError("Kullanıcı parolası ayarlanmamış", 401);

    const valid = verifyPassword(password, user.password_hash);
    if (!valid) return apiError("Kullanıcı adı veya şifre hatalı", 401);

    const loginCount: number = user.login_count ?? 0;
    const isFirstLogin = loginCount === 0;

    // login_count artır
    await pool.request()
      .input("id", sql.Int, user.id)
      .query("UPDATE users SET login_count = login_count + 1 WHERE id = @id");

    // 2FA etkinse ve ilk giriş değilse → 2FA doğrulama sayfasına yönlendir
    if (user.totp_enabled && !isFirstLogin) {
      const pendingToken = await createPendingToken(user.id, user.username);
      const res = NextResponse.json({ success: true, data: { requireTotp: true } });
      res.cookies.set(PENDING_COOKIE, pendingToken, {
        httpOnly: true,
        sameSite: "lax",
        path:     "/",
        maxAge:   PENDING_DURATION / 1000,
      });
      return res;
    }

    // İlk giriş veya 2FA kapalı → direkt oturum aç
    const token = await createSessionToken(user.id, user.username);
    const res = NextResponse.json({ success: true, data: { username: user.username } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
      maxAge:   SESSION_DURATION / 1000,
    });
    return res;
  } catch (err) {
    console.error("[login]", err);
    return apiError("Veritabanı bağlantısı kurulamadı. Lütfen bağlantı ayarlarını kontrol edin.", 503);
  }
}
