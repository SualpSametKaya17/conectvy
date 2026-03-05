import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

/** GET /api/connections/export — şifre dahil tüm bağlantılar (CSV export için) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? null;
    const tool   = searchParams.get("tool")   ?? null;

    const pool   = await getPool();
    const result = await pool.request()
      .input("search", sql.NVarChar, search ? `%${search}%` : "%")
      .input("tool",   sql.NVarChar, tool ?? null)
      .query(`
        SELECT
          c.id, c.name, c.tool,
          c.remote_id AS remoteId,
          c.password,
          c.notes,
          co.name   AS companyName,
          r.name    AS regionName,
          comp.name AS computerName
        FROM connections c
        LEFT JOIN companies co   ON co.id   = c.company_id
        LEFT JOIN regions   r    ON r.id    = c.region_id
        LEFT JOIN computers comp ON comp.id = c.computer_id
        WHERE c.is_active = 1
          AND (@tool   IS NULL OR c.tool  = @tool)
          AND (
            c.name      LIKE @search OR
            c.remote_id LIKE @search OR
            c.notes     LIKE @search
          )
        ORDER BY co.name, r.name, c.tool, c.name
      `);

    return apiSuccess(
      result.recordset.map((row) => ({
        id:           row.id,
        name:         row.name,
        tool:         row.tool,
        remoteId:     row.remoteId,
        password:     row.password     ?? "",
        notes:        row.notes        ?? "",
        companyName:  row.companyName  ?? "",
        regionName:   row.regionName   ?? "",
        computerName: row.computerName ?? "",
      }))
    );
  } catch (error) {
    console.error("[GET /api/connections/export]", error);
    return apiError("Dışa aktarma başarısız", 500);
  }
}
