import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateConnectionSchema, ConnectionQuerySchema } from "@/lib/validations/connection";

/** GET /api/connections */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = ConnectionQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, tool, companyId, regionId, computerId, page, pageSize } = query.data;
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    const req  = pool.request()
      .input("search",     sql.NVarChar, search     ? `%${search}%` : "%")
      .input("tool",       sql.NVarChar, tool       ?? null)
      .input("companyId",  sql.Int,      companyId  ?? null)
      .input("regionId",   sql.Int,      regionId   ?? null)
      .input("computerId", sql.Int,      computerId ?? null)
      .input("pageSize",   sql.Int,      pageSize)
      .input("offset",     sql.Int,      offset);

    const whereExtra = `
      AND c.is_active = 1
      AND (@tool       IS NULL OR c.tool        = @tool)
      AND (@companyId  IS NULL OR c.company_id  = @companyId)
      AND (@regionId   IS NULL OR c.region_id   = @regionId)
      AND (@computerId IS NULL OR c.computer_id = @computerId)
      AND (
        c.name      LIKE @search OR
        c.remote_id LIKE @search OR
        c.notes     LIKE @search
      )
    `;

    const [items, count] = await Promise.all([
      req.query(`
        SELECT
          c.id, c.name, c.tool,
          c.remote_id   AS remoteId,
          c.company_id  AS companyId,  co.name  AS companyName,
          c.region_id   AS regionId,   r.name   AS regionName,
          c.computer_id AS computerId, cmp.name AS computerName,
          c.notes,
          c.is_active  AS isActive,
          c.last_connected_at AS lastConnectedAt,
          c.created_at AS createdAt,
          c.updated_at AS updatedAt
          -- password intentionally excluded from list
        FROM connections c
        LEFT JOIN companies co  ON co.id  = c.company_id
        LEFT JOIN regions   r   ON r.id   = c.region_id
        LEFT JOIN computers cmp ON cmp.id = c.computer_id
        WHERE 1=1 ${whereExtra}
        ORDER BY c.updated_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      pool.request()
        .input("search",     sql.NVarChar, search     ? `%${search}%` : "%")
        .input("tool",       sql.NVarChar, tool       ?? null)
        .input("companyId",  sql.Int,      companyId  ?? null)
        .input("regionId",   sql.Int,      regionId   ?? null)
        .input("computerId", sql.Int,      computerId ?? null)
        .query(`
          SELECT COUNT(*) AS total
          FROM connections c
          WHERE 1=1 ${whereExtra}
        `),
    ]);

    const formatted = items.recordset.map((row) => ({
      id:              row.id,
      name:            row.name,
      tool:            row.tool,
      remoteId:        row.remoteId,
      notes:           row.notes,
      isActive:        row.isActive,
      lastConnectedAt: row.lastConnectedAt,
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
      company:  row.companyId  ? { id: row.companyId,  name: row.companyName  } : null,
      region:   row.regionId   ? { id: row.regionId,   name: row.regionName   } : null,
      computer: row.computerId ? { id: row.computerId, name: row.computerName } : null,
    }));

    return apiSuccess({ items: formatted, total: count.recordset[0].total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/connections]", error);
    return apiError("Bağlantılar alınamadı", 500);
  }
}

/** POST /api/connections */
export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const parsed = CreateConnectionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, tool, remoteId, password, companyId, regionId, computerId, notes } = parsed.data;
    const pool = await getPool();

    const result = await pool.request()
      .input("name",       sql.NVarChar, name)
      .input("tool",       sql.NVarChar, tool)
      .input("remoteId",   sql.NVarChar, remoteId)
      .input("password",   sql.NVarChar, password   || null)
      .input("companyId",  sql.Int,      companyId  ?? null)
      .input("regionId",   sql.Int,      regionId   ?? null)
      .input("computerId", sql.Int,      computerId ?? null)
      .input("notes",      sql.NVarChar, notes      || null)
      .query(`
        INSERT INTO connections (name, tool, remote_id, password, company_id, region_id, computer_id, notes)
        OUTPUT
          INSERTED.id, INSERTED.name, INSERTED.tool,
          INSERTED.remote_id   AS remoteId,
          INSERTED.company_id  AS companyId,
          INSERTED.region_id   AS regionId,
          INSERTED.computer_id AS computerId,
          INSERTED.notes,
          INSERTED.is_active   AS isActive,
          INSERTED.created_at  AS createdAt,
          INSERTED.updated_at  AS updatedAt
        VALUES (@name, @tool, @remoteId, @password, @companyId, @regionId, @computerId, @notes)
      `);

    return apiSuccess(result.recordset[0], 201);
  } catch (error) {
    console.error("[POST /api/connections]", error);
    return apiError("Bağlantı oluşturulamadı", 500);
  }
}
