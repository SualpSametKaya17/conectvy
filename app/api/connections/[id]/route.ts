import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateConnectionSchema } from "@/lib/validations/connection";

function getIdParam(params: { id: string }): number | null {
  const n = parseInt(params.id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/connections/:id  — şifreyi de döner */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = getIdParam(await params);
    if (!id) return apiError("Geçerli bir ID giriniz", 400);

    const pool   = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT
          c.id, c.name, c.tool,
          c.remote_id   AS remoteId,
          c.password,
          c.company_id  AS companyId,  co.name  AS companyName,
          c.region_id   AS regionId,   r.name   AS regionName,
          c.computer_id AS computerId, cmp.name AS computerName,
          c.notes, c.is_active AS isActive,
          c.last_connected_at AS lastConnectedAt,
          c.created_at AS createdAt, c.updated_at AS updatedAt
        FROM connections c
        LEFT JOIN companies co  ON co.id  = c.company_id
        LEFT JOIN regions   r   ON r.id   = c.region_id
        LEFT JOIN computers cmp ON cmp.id = c.computer_id
        WHERE c.id = @id AND c.is_active = 1
      `);

    const row = result.recordset[0];
    if (!row) return apiError("Bağlantı bulunamadı", 404);

    return apiSuccess({
      ...row,
      company:  row.companyId  ? { id: row.companyId,  name: row.companyName  } : null,
      region:   row.regionId   ? { id: row.regionId,   name: row.regionName   } : null,
      computer: row.computerId ? { id: row.computerId, name: row.computerName } : null,
    });
  } catch (err) {
    console.error("[connections GET/:id]", err);
    return apiError("Veritabanı bağlantısı kurulamadı", 503);
  }
}

/** PATCH /api/connections/:id */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = getIdParam(await params);
  if (!id) return apiError("Geçerli bir ID giriniz", 400);

  const body   = await request.json();
  const update = UpdateConnectionSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const pool = await getPool();
    const sets: string[] = [];
    const req = pool.request().input("id", sql.Int, id);

    if (update.data.name       !== undefined) { sets.push("name = @name");              req.input("name",       sql.NVarChar, update.data.name); }
    if (update.data.tool       !== undefined) { sets.push("tool = @tool");              req.input("tool",       sql.NVarChar, update.data.tool); }
    if (update.data.remoteId   !== undefined) { sets.push("remote_id = @remoteId");     req.input("remoteId",   sql.NVarChar, update.data.remoteId); }
    if (update.data.password   !== undefined) { sets.push("password = @password");      req.input("password",   sql.NVarChar, update.data.password   || null); }
    if (update.data.companyId  !== undefined) { sets.push("company_id = @companyId");   req.input("companyId",  sql.Int,      update.data.companyId  ?? null); }
    if (update.data.regionId   !== undefined) { sets.push("region_id = @regionId");     req.input("regionId",   sql.Int,      update.data.regionId   ?? null); }
    if (update.data.computerId !== undefined) { sets.push("computer_id = @computerId"); req.input("computerId", sql.Int,      update.data.computerId ?? null); }
    if (update.data.notes      !== undefined) { sets.push("notes = @notes");            req.input("notes",      sql.NVarChar, update.data.notes      || null); }

    if (sets.length === 0) return apiError("Güncellenecek alan yok", 400);

    await req.query(`UPDATE connections SET ${sets.join(", ")} WHERE id = @id`);

    const updated = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT c.id, c.name, c.tool,
          c.remote_id   AS remoteId, c.password,
          c.company_id  AS companyId,  co.name  AS companyName,
          c.region_id   AS regionId,   r.name   AS regionName,
          c.computer_id AS computerId, cmp.name AS computerName,
          c.notes, c.is_active AS isActive,
          c.created_at AS createdAt, c.updated_at AS updatedAt
        FROM connections c
        LEFT JOIN companies co  ON co.id  = c.company_id
        LEFT JOIN regions   r   ON r.id   = c.region_id
        LEFT JOIN computers cmp ON cmp.id = c.computer_id
        WHERE c.id = @id
      `);

    const row = updated.recordset[0];
    if (!row) return apiError("Bağlantı bulunamadı", 404);

    return apiSuccess({
      ...row,
      company:  row.companyId  ? { id: row.companyId,  name: row.companyName  } : null,
      region:   row.regionId   ? { id: row.regionId,   name: row.regionName   } : null,
      computer: row.computerId ? { id: row.computerId, name: row.computerName } : null,
    });
  } catch (error) {
    console.error("[PATCH /api/connections/:id]", error);
    return apiError("Bağlantı güncellenemedi", 500);
  }
}

/** DELETE /api/connections/:id  (soft delete) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = getIdParam(await params);
    if (!id) return apiError("Geçerli bir ID giriniz", 400);

    const pool   = await getPool();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("UPDATE connections SET is_active = 0 WHERE id = @id; SELECT @@ROWCOUNT AS affected");

    if (!result.recordset[0]?.affected) return apiError("Bağlantı bulunamadı", 404);
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[connections DELETE/:id]", err);
    return apiError("Veritabanı bağlantısı kurulamadı", 503);
  }
}
