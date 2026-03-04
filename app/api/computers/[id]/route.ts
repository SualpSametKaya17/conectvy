import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateComputerSchema } from "@/lib/validations/computer";

function getIdParam(params: { id: string }): number | null {
  const n = parseInt(params.id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/computers/:id */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT co.id, co.device_type AS deviceType,
             co.company_id AS companyId, comp.name AS companyName,
             co.name, co.description, co.is_active AS isActive,
             co.created_at AS createdAt, co.updated_at AS updatedAt,
             (SELECT COUNT(*) FROM connections cn WHERE cn.computer_id = co.id AND cn.is_active = 1)                           AS connectionCount,
             (SELECT COUNT(*) FROM connections cn WHERE cn.computer_id = co.id AND cn.is_active = 1 AND cn.tool = 'RUSTDESK') AS rustdeskCount,
             (SELECT COUNT(*) FROM connections cn WHERE cn.computer_id = co.id AND cn.is_active = 1 AND cn.tool = 'ANYDESK')  AS anyDeskCount
      FROM computers co
      JOIN companies comp ON comp.id = co.company_id
      WHERE co.id = @id AND co.is_active = 1
    `);

  const row = result.recordset[0];
  if (!row) return apiError("Cihaz bulunamadı", 404);

  return apiSuccess({
    ...row,
    company: { id: row.companyId, name: row.companyName },
    _count:  { connections: row.connectionCount, rustdesk: row.rustdeskCount, anydesk: row.anyDeskCount },
  });
}

/** PATCH /api/computers/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const body   = await request.json();
  const update = UpdateComputerSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const pool = await getPool();
    const sets: string[] = [];
    const req = pool.request().input("id", sql.Int, id);

    if (update.data.deviceType  !== undefined) { sets.push("device_type = @deviceType");   req.input("deviceType",  sql.NVarChar, update.data.deviceType); }
    if (update.data.companyId   !== undefined) { sets.push("company_id = @companyId");     req.input("companyId",   sql.Int,      update.data.companyId); }
    if (update.data.name        !== undefined) { sets.push("name = @name");                req.input("name",        sql.NVarChar, update.data.name); }
    if (update.data.description !== undefined) { sets.push("description = @description"); req.input("description", sql.NVarChar, update.data.description || null); }

    if (sets.length === 0) return apiError("Güncellenecek alan yok", 400);

    await req.query(`UPDATE computers SET ${sets.join(", ")} WHERE id = @id AND is_active = 1`);

    const updated = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT co.id, co.device_type AS deviceType,
               co.company_id AS companyId, comp.name AS companyName,
               co.name, co.description, co.is_active AS isActive,
               co.created_at AS createdAt, co.updated_at AS updatedAt
        FROM computers co
        JOIN companies comp ON comp.id = co.company_id
        WHERE co.id = @id
      `);

    const row = updated.recordset[0];
    if (!row) return apiError("Cihaz bulunamadı", 404);

    return apiSuccess({ ...row, company: { id: row.companyId, name: row.companyName } });
  } catch (error) {
    console.error("[PATCH /api/computers/:id]", error);
    return apiError("Cihaz güncellenemedi", 500);
  }
}

/** DELETE /api/computers/:id  (soft delete) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query("UPDATE computers SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

  if (!result.recordset[0]?.affected) return apiError("Cihaz bulunamadı", 404);
  return apiSuccess({ deleted: true });
}
