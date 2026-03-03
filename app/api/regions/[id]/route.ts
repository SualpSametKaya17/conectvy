import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateRegionSchema, RegionIdSchema } from "@/lib/validations/region";

function parseId(params: { id: string }) {
  return RegionIdSchema.safeParse(params);
}

/** GET /api/regions/:id */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, parsed.data.id)
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
}

/** PATCH /api/regions/:id */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const body   = await request.json();
  const update = UpdateRegionSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const pool = await getPool();

    // Build dynamic SET clause
    const sets: string[] = [];
    const req = pool.request().input("id", sql.Int, parsed.data.id);

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
      .input("id", sql.Int, parsed.data.id)
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
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, parsed.data.id)
    .query("UPDATE regions SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

  if (!result.recordset[0]?.affected) return apiError("Bölge bulunamadı", 404);
  return apiSuccess({ deleted: true });
}
