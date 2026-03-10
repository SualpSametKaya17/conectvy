/**
 * 2FA Kurulum API'si (kimlik doğrulaması gerektirir)
 *
 * GET    /api/auth/2fa/setup  → Yeni secret + QR kodu üret (henüz kaydetme)
 * POST   /api/auth/2fa/setup  → Kodu doğrula ve 2FA'yı etkinleştir
 * DELETE /api/auth/2fa/setup  → 2FA'yı devre dışı bırak
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiError, apiSuccess } from "@/lib/utils";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getPool, sql } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { generateTotpSecret, generateTotpUri, generateQrDataUrl, verifyTotpToken } from "@/lib/totp";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifySessionToken(token);
    if (payload.pendingTotp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** DB'ye totp kolonları yoksa ekle (lazy migration) */
async function ensureColumns(pool: Awaited<ReturnType<typeof getPool>>) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'totp_secret')
      ALTER TABLE users ADD totp_secret NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'totp_enabled')
      ALTER TABLE users ADD totp_enabled BIT NOT NULL DEFAULT 0;
  `);
}

// GET → QR kodu ve secret üret (geçici, henüz kaydedilmez)
export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiError("Oturum açılmamış", 401);

  const pool = await getPool();
  await ensureColumns(pool);

  // Mevcut durumu da döndür
  const result = await pool.request()
    .input("userId", sql.Int, user.userId)
    .query("SELECT totp_enabled FROM users WHERE id = @userId");
  const isEnabled = !!result.recordset[0]?.totp_enabled;

  const secret    = generateTotpSecret();
  const uri       = generateTotpUri(secret, user.username);
  const qrDataUrl = await generateQrDataUrl(uri);

  return NextResponse.json({
    success: true,
    data: { secret, qrDataUrl, isEnabled },
  });
}

// POST → İlk kodu doğrula + secret kaydet + 2FA etkinleştir
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiError("Oturum açılmamış", 401);

  const { secret, code } = await req.json();
  if (!secret || !code) return apiError("secret ve code zorunludur", 400);

  const valid = verifyTotpToken(secret, code);
  if (!valid) return apiError("Geçersiz kod, tekrar deneyin", 401);

  const pool = await getPool();
  await ensureColumns(pool);

  const encryptedSecret = encrypt(secret);
  await pool.request()
    .input("userId", sql.Int, user.userId)
    .input("secret", sql.NVarChar, encryptedSecret)
    .query("UPDATE users SET totp_secret = @secret, totp_enabled = 1 WHERE id = @userId");

  return apiSuccess({ message: "2FA etkinleştirildi" });
}

// DELETE → 2FA'yı devre dışı bırak
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiError("Oturum açılmamış", 401);

  // İsteğe bağlı: mevcut TOTP kodu ile doğrula
  let code: string | undefined;
  try { code = (await req.json())?.code; } catch { /* body yok */ }

  const pool = await getPool();
  await ensureColumns(pool);

  if (code) {
    const result = await pool.request()
      .input("userId", sql.Int, user.userId)
      .query("SELECT totp_secret FROM users WHERE id = @userId");
    const row = result.recordset[0];
    if (row?.totp_secret) {
      const secret = decrypt(row.totp_secret);
      if (!verifyTotpToken(secret, code)) return apiError("Geçersiz kod", 401);
    }
  }

  await pool.request()
    .input("userId", sql.Int, user.userId)
    .query("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = @userId");

  return apiSuccess({ message: "2FA devre dışı bırakıldı" });
}
