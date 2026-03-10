import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";
import { hashPassword } from "@/lib/crypto";
import { z } from "zod";

async function hasUsers(): Promise<boolean> {
  const pool   = await getPool();
  const result = await pool.request().query("SELECT COUNT(*) AS cnt FROM users");
  return (result.recordset[0]?.cnt ?? 0) > 0;
}

/** GET /api/auth/setup — kurulum yapılabilir mi? */
export async function GET() {
  try {
    const exists = await hasUsers();
    if (exists) return apiError("Kurulum zaten tamamlanmış", 403);
    return apiSuccess({ canSetup: true });
  } catch (err) {
    console.error("[setup GET]", err);
    return apiError("Veritabanı bağlantısı kurulamadı. Lütfen bağlantı ayarlarını kontrol edin.", 503);
  }
}

const SetupBodySchema = z.object({
  username: z.string().min(3).max(100),
  email:    z.string().email().max(255).optional().or(z.literal("")),
  password: z.string().min(6).max(255),
});

/** POST /api/auth/setup — ilk yönetici hesabını oluştur */
export async function POST(req: Request) {
  try {
    const exists = await hasUsers();
    if (exists) return apiError("Kurulum zaten tamamlanmış", 403);

    const body   = await req.json();
    const parsed = SetupBodySchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? "Geçersiz veri", 422);

    const { username, email, password } = parsed.data;
    const hash = hashPassword(password);

    const pool = await getPool();
    await pool.request()
      .input("username",      sql.NVarChar, username)
      .input("email",         sql.NVarChar, email || null)
      .input("password_hash", sql.NVarChar, hash)
      .query(`
        INSERT INTO users (username, email, password_hash, is_active)
        VALUES (@username, @email, @password_hash, 1)
      `);

    return apiSuccess({ created: true }, 201);
  } catch (err) {
    console.error("[setup POST]", err);
    return apiError("Veritabanı bağlantısı kurulamadı. Lütfen bağlantı ayarlarını kontrol edin.", 503);
  }
}
