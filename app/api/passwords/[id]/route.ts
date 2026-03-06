import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdatePasswordSchema } from "@/lib/validations/password";
import { encrypt, decrypt } from "@/lib/crypto";

function getId(params: { id: string }): number | null {
  const n = parseInt(params.id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function safeDecrypt(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try { return decrypt(ciphertext); }
  catch { return ciphertext; } // Eski plain-text kayıtlar için fallback
}

/** GET /api/passwords/:id  (şifre dahil, çözümlenmiş) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getId(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT id, title, username, password, url, category, notes,
             created_at AS createdAt, updated_at AS updatedAt
      FROM passwords
      WHERE id = @id AND is_active = 1
    `);

  const row = result.recordset[0];
  if (!row) return apiError("Kayıt bulunamadı", 404);

  return apiSuccess({ ...row, password: safeDecrypt(row.password) });
}

/** PATCH /api/passwords/:id */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getId(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const body   = await req.json();
  const update = UpdatePasswordSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  const pool = await getPool();
  const sets: string[] = [];
  const r = pool.request().input("id", sql.Int, id);

  if (update.data.title    !== undefined) { sets.push("title = @title");       r.input("title",    sql.NVarChar, update.data.title); }
  if (update.data.username !== undefined) { sets.push("username = @username"); r.input("username", sql.NVarChar, update.data.username || null); }
  if (update.data.password !== undefined) {
    const enc = update.data.password ? encrypt(update.data.password) : null;
    sets.push("password = @password");
    r.input("password", sql.NVarChar, enc);
  }
  if (update.data.url      !== undefined) { sets.push("url = @url");           r.input("url",      sql.NVarChar, update.data.url      || null); }
  if (update.data.category !== undefined) { sets.push("category = @category"); r.input("category", sql.NVarChar, update.data.category || "Genel"); }
  if (update.data.notes    !== undefined) { sets.push("notes = @notes");       r.input("notes",    sql.NVarChar, update.data.notes    || null); }

  if (sets.length === 0) return apiError("Güncellenecek alan yok", 400);

  sets.push("updated_at = GETDATE()");
  await r.query(`UPDATE passwords SET ${sets.join(", ")} WHERE id = @id AND is_active = 1`);

  const updated = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT id, title, username, url, category, notes,
             created_at AS createdAt, updated_at AS updatedAt
      FROM passwords WHERE id = @id
    `);

  return apiSuccess(updated.recordset[0]);
}

/** DELETE /api/passwords/:id  (soft delete) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getId(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query("UPDATE passwords SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

  if (!result.recordset[0]?.affected) return apiError("Kayıt bulunamadı", 404);
  return apiSuccess({ deleted: true });
}
