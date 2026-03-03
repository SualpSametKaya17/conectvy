import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateCompanySchema, CompanyIdSchema } from "@/lib/validations/company";

function parseId(params: { id: string }) {
  return CompanyIdSchema.safeParse(params);
}

/** GET /api/companies/:id */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, parsed.data.id)
    .query(`
      SELECT c.id, c.name, c.description, c.is_active AS isActive,
             c.created_at AS createdAt, c.updated_at AS updatedAt,
             (SELECT COUNT(*) FROM connections cn WHERE cn.company_id = c.id) AS connectionCount
      FROM companies c
      WHERE c.id = @id
    `);

  if (!result.recordset[0]) return apiError("Firma bulunamadı", 404);
  return apiSuccess(result.recordset[0]);
}

/** PATCH /api/companies/:id */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const body   = await request.json();
  const update = UpdateCompanySchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const pool = await getPool();

    // Name uniqueness check (exclude self)
    if (update.data.name) {
      const dup = await pool.request()
        .input("name", sql.NVarChar, update.data.name)
        .input("id",   sql.Int,      parsed.data.id)
        .query("SELECT id FROM companies WHERE name = @name AND id <> @id");
      if (dup.recordset.length > 0) return apiError("Bu firma adı zaten kayıtlı", 409);
    }

    const result = await pool.request()
      .input("id",          sql.Int,      parsed.data.id)
      .input("name",        sql.NVarChar, update.data.name        ?? null)
      .input("description", sql.NVarChar, update.data.description ?? null)
      .query(`
        UPDATE companies SET
          name        = COALESCE(@name, name),
          description = CASE WHEN @description IS NULL AND @name IS NOT NULL THEN description ELSE COALESCE(@description, description) END
        WHERE id = @id;
        SELECT id, name, description, is_active AS isActive,
               created_at AS createdAt, updated_at AS updatedAt
        FROM companies WHERE id = @id;
      `);

    if (!result.recordset[0]) return apiError("Firma bulunamadı", 404);
    return apiSuccess(result.recordset[0]);
  } catch (error) {
    console.error("[PATCH /api/companies/:id]", error);
    return apiError("Firma güncellenemedi", 500);
  }
}

/** DELETE /api/companies/:id  (soft delete) */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, parsed.data.id)
    .query("UPDATE companies SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

  if (!result.recordset[0]?.affected) return apiError("Firma bulunamadı", 404);
  return apiSuccess({ deleted: true });
}
