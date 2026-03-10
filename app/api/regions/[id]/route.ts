import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateRegionSchema } from "@/lib/validations/region";

function getIdParam(params: { id: string }): number | null {
  const n = parseInt(params.id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/regions/:id */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = getIdParam(await params);
    if (!id) return apiError("Geçerli bir ID giriniz", 400);

    const pool   = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT r.id, r.name, r.description, r.is_active AS isActive,
               r.company_id AS companyId, co.name AS companyName,
               r.created_at AS createdAt, r.updated_at AS updatedAt,
               (SELECT COUNT(*) FROM connections c WHERE c.region_id = r.id) AS connectionCount
        FROM regions r
        LEFT JOIN companies co ON co.id = r.company_id
        WHERE r.id = @id
      `);

    const row = result.recordset[0];
    if (!row) return apiError("Bölge bulunamadı", 404);

    return apiSuccess({
      ...row,
      company: row.companyId ? { id: row.companyId, name: row.companyName } : null,
      _count:  { connections: row.connectionCount },
    });
  } catch (err) {
    console.error("[regions GET/:id]", err);
    return apiError("Veritabanı bağlantısı kurulamadı", 503);
  }
}

/** PATCH /api/regions/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const body   = await request.json();
  const update = UpdateRegionSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const pool = await getPool();

    const sets: string[] = [];
    const req = pool.request().input("id", sql.Int, id);

    if (update.data.name !== undefined) {
      sets.push("name = @name");
      req.input("name", sql.NVarChar, update.data.name);
    }
    if (update.data.description !== undefined) {
      sets.push("description = @description");
      req.input("description", sql.NVarChar, update.data.description || null);
    }
    if (update.data.companyId !== undefined) {
      sets.push("company_id = @companyId");
      req.input("companyId", sql.Int, update.data.companyId ?? null);
    }

    if (sets.length === 0) return apiError("Güncellenecek alan yok", 400);

    await req.query(`UPDATE regions SET ${sets.join(", ")} WHERE id = @id`);

    const updated = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT r.id, r.name, r.description, r.is_active AS isActive,
               r.company_id AS companyId, co.name AS companyName,
               r.created_at AS createdAt, r.updated_at AS updatedAt
        FROM regions r LEFT JOIN companies co ON co.id = r.company_id
        WHERE r.id = @id
      `);

    const row = updated.recordset[0];
    if (!row) return apiError("Bölge bulunamadı", 404);

    return apiSuccess({
      ...row,
      company: row.companyId ? { id: row.companyId, name: row.companyName } : null,
    });
  } catch (error) {
    console.error("[PATCH /api/regions/:id]", error);
    return apiError("Bölge güncellenemedi", 500);
  }
}

/** DELETE /api/regions/:id  (soft delete) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = getIdParam(await params);
    if (!id) return apiError("Geçerli bir ID giriniz", 400);

    const pool   = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("UPDATE regions SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

    if (!result.recordset[0]?.affected) return apiError("Bölge bulunamadı", 404);
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[regions DELETE/:id]", err);
    return apiError("Veritabanı bağlantısı kurulamadı", 503);
  }
}
