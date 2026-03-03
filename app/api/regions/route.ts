import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateRegionSchema, RegionQuerySchema } from "@/lib/validations/region";

/** GET /api/regions */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = RegionQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, companyId, page, pageSize } = query.data;
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    const req  = pool.request()
      .input("search",    sql.NVarChar, search    ? `%${search}%` : "%")
      .input("companyId", sql.Int,      companyId ?? null)
      .input("pageSize",  sql.Int,      pageSize)
      .input("offset",    sql.Int,      offset);

    const [items, count] = await Promise.all([
      req.query(`
        SELECT
          r.id, r.name, r.description, r.is_active AS isActive,
          r.company_id AS companyId,   co.name AS companyName,
          r.created_at AS createdAt,   r.updated_at AS updatedAt,
          (SELECT COUNT(*) FROM connections c WHERE c.region_id = r.id) AS connectionCount
        FROM regions r
        LEFT JOIN companies co ON co.id = r.company_id
        WHERE r.name LIKE @search
          AND (@companyId IS NULL OR r.company_id = @companyId)
        ORDER BY r.name
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      pool.request()
        .input("search",    sql.NVarChar, search    ? `%${search}%` : "%")
        .input("companyId", sql.Int,      companyId ?? null)
        .query(`
          SELECT COUNT(*) AS total FROM regions r
          WHERE r.name LIKE @search
            AND (@companyId IS NULL OR r.company_id = @companyId)
        `),
    ]);

    const formatted = items.recordset.map((r) => ({
      id:          r.id,
      name:        r.name,
      description: r.description,
      isActive:    r.isActive,
      createdAt:   r.createdAt,
      updatedAt:   r.updatedAt,
      company:     r.companyId ? { id: r.companyId, name: r.companyName } : null,
      _count:      { connections: r.connectionCount },
    }));

    return apiSuccess({ items: formatted, total: count.recordset[0].total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/regions]", error);
    return apiError("Bölgeler alınamadı", 500);
  }
}

/** POST /api/regions */
export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const parsed = CreateRegionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, description, companyId } = parsed.data;
    const pool = await getPool();

    const result = await pool.request()
      .input("name",        sql.NVarChar, name)
      .input("description", sql.NVarChar, description || null)
      .input("companyId",   sql.Int,      companyId   ?? null)
      .query(`
        INSERT INTO regions (name, description, company_id)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.description,
               INSERTED.company_id AS companyId,
               INSERTED.is_active AS isActive,
               INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
        VALUES (@name, @description, @companyId)
      `);

    return apiSuccess(result.recordset[0], 201);
  } catch (error) {
    console.error("[POST /api/regions]", error);
    return apiError("Bölge oluşturulamadı", 500);
  }
}
