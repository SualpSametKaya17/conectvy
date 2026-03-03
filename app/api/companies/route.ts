import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateCompanySchema, CompanyQuerySchema } from "@/lib/validations/company";

/**
 * GET /api/companies
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = CompanyQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, page, pageSize } = query.data;
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    const req  = pool.request()
      .input("search",   sql.NVarChar, search ? `%${search}%` : "%")
      .input("pageSize", sql.Int, pageSize)
      .input("offset",   sql.Int, offset);

    const [items, count] = await Promise.all([
      req.query(`
        SELECT
          c.id, c.name, c.description, c.is_active AS isActive,
          c.created_at AS createdAt, c.updated_at AS updatedAt,
          (SELECT COUNT(*) FROM connections cn WHERE cn.company_id = c.id) AS connectionCount,
          (SELECT COUNT(*) FROM regions     r  WHERE r.company_id  = c.id) AS regionCount
        FROM companies c
        WHERE c.name LIKE @search
        ORDER BY c.name
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      pool.request()
        .input("search", sql.NVarChar, search ? `%${search}%` : "%")
        .query(`SELECT COUNT(*) AS total FROM companies WHERE name LIKE @search`),
    ]);

    const formatted = items.recordset.map((r) => ({
      ...r,
      _count: { connections: r.connectionCount, regions: r.regionCount },
    }));

    return apiSuccess({ items: formatted, total: count.recordset[0].total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/companies]", error);
    return apiError("Firmalar alınamadı", 500);
  }
}

/**
 * POST /api/companies
 */
export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, description } = parsed.data;
    const pool = await getPool();

    // Uniqueness check
    const exists = await pool.request()
      .input("name", sql.NVarChar, name)
      .query("SELECT id FROM companies WHERE name = @name");
    if (exists.recordset.length > 0) return apiError("Bu firma adı zaten kayıtlı", 409);

    const result = await pool.request()
      .input("name",        sql.NVarChar, name)
      .input("description", sql.NVarChar, description || null)
      .query(`
        INSERT INTO companies (name, description)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.description,
               INSERTED.is_active AS isActive,
               INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
        VALUES (@name, @description)
      `);

    return apiSuccess(result.recordset[0], 201);
  } catch (error) {
    console.error("[POST /api/companies]", error);
    return apiError("Firma oluşturulamadı", 500);
  }
}
