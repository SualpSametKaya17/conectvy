import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateCompanySchema } from "@/lib/validations/company";

function getIdParam(params: { id: string }): number | null {
  const n = parseInt(params.id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/companies/:id */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT c.id, c.name, c.description, c.is_active AS isActive,
             c.maintenance_start_date AS maintenanceStartDate,
             c.maintenance_end_date   AS maintenanceEndDate,
             c.created_at AS createdAt, c.updated_at AS updatedAt,
             (SELECT COUNT(*) FROM connections cn WHERE cn.company_id = c.id AND cn.is_active = 1) AS connectionCount,
             (SELECT COUNT(*) FROM computers   co WHERE co.company_id = c.id AND co.is_active = 1) AS computerCount
      FROM companies c
      WHERE c.id = @id
    `);

  if (!result.recordset[0]) return apiError("Firma bulunamadı", 404);
  return apiSuccess(result.recordset[0]);
}

/** PATCH /api/companies/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const body   = await request.json();
  const update = UpdateCompanySchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const pool = await getPool();

    // Name uniqueness check (exclude self)
    if (update.data.name) {
      const dup = await pool.request()
        .input("name", sql.NVarChar, update.data.name)
        .input("id",   sql.Int,      id)
        .query("SELECT id FROM companies WHERE name = @name AND id <> @id AND is_active = 1");
      if (dup.recordset.length > 0) return apiError("Bu firma adı zaten kayıtlı", 409);
    }

    const req = pool.request().input("id", sql.Int, id);
    const sets: string[] = [];

    if (update.data.name !== undefined) {
      sets.push("name = @name");
      req.input("name", sql.NVarChar, update.data.name);
    }
    if (update.data.description !== undefined) {
      sets.push("description = @description");
      req.input("description", sql.NVarChar, update.data.description || null);
    }
    if (update.data.maintenanceStartDate !== undefined) {
      sets.push("maintenance_start_date = @maintenanceStartDate");
      req.input("maintenanceStartDate", sql.Date, update.data.maintenanceStartDate || null);
    }
    if (update.data.maintenanceEndDate !== undefined) {
      sets.push("maintenance_end_date = @maintenanceEndDate");
      req.input("maintenanceEndDate", sql.Date, update.data.maintenanceEndDate || null);
    }

    if (sets.length === 0) return apiError("Güncellenecek alan yok", 400);

    await req.query(`UPDATE companies SET ${sets.join(", ")} WHERE id = @id`);

    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT id, name, description, is_active AS isActive,
               maintenance_start_date AS maintenanceStartDate,
               maintenance_end_date   AS maintenanceEndDate,
               created_at AS createdAt, updated_at AS updatedAt
        FROM companies WHERE id = @id
      `);

    if (!result.recordset[0]) return apiError("Firma bulunamadı", 404);
    return apiSuccess(result.recordset[0]);
  } catch (error) {
    console.error("[PATCH /api/companies/:id]", error);
    return apiError("Firma güncellenemedi", 500);
  }
}

/** DELETE /api/companies/:id  (soft delete) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query("UPDATE companies SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

  if (!result.recordset[0]?.affected) return apiError("Firma bulunamadı", 404);
  return apiSuccess({ deleted: true });
}
