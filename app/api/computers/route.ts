import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateComputerSchema, ComputerQuerySchema } from "@/lib/validations/computer";

/**
 * GET /api/computers
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = ComputerQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, companyId, deviceType, page, pageSize } = query.data;
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    const req  = pool.request()
      .input("search",     sql.NVarChar, search     ? `%${search}%` : "%")
      .input("companyId",  sql.Int,      companyId  ?? null)
      .input("deviceType", sql.NVarChar, deviceType ?? null)
      .input("pageSize",   sql.Int,      pageSize)
      .input("offset",     sql.Int,      offset);

    const whereExtra = `
      AND co.is_active = 1
      AND (@companyId  IS NULL OR co.company_id  = @companyId)
      AND (@deviceType IS NULL OR co.device_type = @deviceType)
      AND (co.name LIKE @search OR co.description LIKE @search OR comp.name LIKE @search)
    `;

    const [items, count] = await Promise.all([
      req.query(`
        SELECT
          co.id,
          co.device_type  AS deviceType,
          co.company_id   AS companyId,
          comp.name       AS companyName,
          co.name,
          co.description,
          co.is_active    AS isActive,
          co.created_at   AS createdAt,
          co.updated_at   AS updatedAt,
          (SELECT COUNT(*) FROM connections cn WHERE cn.computer_id = co.id AND cn.is_active = 1)                           AS connectionCount,
          (SELECT COUNT(*) FROM connections cn WHERE cn.computer_id = co.id AND cn.is_active = 1 AND cn.tool = 'RUSTDESK') AS rustdeskCount,
          (SELECT COUNT(*) FROM connections cn WHERE cn.computer_id = co.id AND cn.is_active = 1 AND cn.tool = 'ANYDESK')  AS anyDeskCount
        FROM computers co
        JOIN companies comp ON comp.id = co.company_id
        WHERE 1=1 ${whereExtra}
        ORDER BY comp.name, co.name
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      pool.request()
        .input("search",     sql.NVarChar, search     ? `%${search}%` : "%")
        .input("companyId",  sql.Int,      companyId  ?? null)
        .input("deviceType", sql.NVarChar, deviceType ?? null)
        .query(`
          SELECT COUNT(*) AS total
          FROM computers co
          JOIN companies comp ON comp.id = co.company_id
          WHERE 1=1 ${whereExtra}
        `),
    ]);

    const formatted = items.recordset.map((r) => ({
      id:          r.id,
      deviceType:  r.deviceType,
      name:        r.name,
      description: r.description,
      isActive:    r.isActive,
      createdAt:   r.createdAt,
      updatedAt:   r.updatedAt,
      company:     { id: r.companyId, name: r.companyName },
      _count:      { connections: r.connectionCount, rustdesk: r.rustdeskCount, anydesk: r.anyDeskCount },
    }));

    return apiSuccess({ items: formatted, total: count.recordset[0].total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/computers]", error);
    return apiError("Cihazlar alınamadı", 500);
  }
}

/**
 * POST /api/computers
 */
export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const parsed = CreateComputerSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { deviceType, companyId, name, description } = parsed.data;
    const pool = await getPool();

    const company = await pool.request()
      .input("companyId", sql.Int, companyId)
      .query("SELECT id FROM companies WHERE id = @companyId AND is_active = 1");
    if (company.recordset.length === 0) return apiError("Firma bulunamadı", 404);

    const result = await pool.request()
      .input("deviceType",  sql.NVarChar, deviceType)
      .input("companyId",   sql.Int,      companyId)
      .input("name",        sql.NVarChar, name)
      .input("description", sql.NVarChar, description || null)
      .query(`
        INSERT INTO computers (device_type, company_id, name, description)
        OUTPUT INSERTED.id, INSERTED.device_type AS deviceType,
               INSERTED.company_id AS companyId, INSERTED.name,
               INSERTED.description, INSERTED.is_active AS isActive,
               INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
        VALUES (@deviceType, @companyId, @name, @description)
      `);

    return apiSuccess(result.recordset[0], 201);
  } catch (error) {
    console.error("[POST /api/computers]", error);
    return apiError("Cihaz oluşturulamadı", 500);
  }
}
