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
        WITH
          conn_agg AS (
            SELECT company_id, COUNT(*) AS cnt
            FROM connections WHERE is_active = 1
            GROUP BY company_id
          ),
          region_agg AS (
            SELECT company_id, COUNT(*) AS cnt
            FROM regions
            GROUP BY company_id
          ),
          computer_agg AS (
            SELECT company_id, COUNT(*) AS cnt
            FROM computers WHERE is_active = 1
            GROUP BY company_id
          )
        SELECT
          c.id, c.name, c.description, c.is_active AS isActive,
          c.maintenance_start_date AS maintenanceStartDate,
          c.maintenance_end_date   AS maintenanceEndDate,
          c.created_at AS createdAt, c.updated_at AS updatedAt,
          COALESCE(cn.cnt, 0)  AS connectionCount,
          COALESCE(r.cnt,  0)  AS regionCount,
          COALESCE(co.cnt, 0)  AS computerCount
        FROM companies c
        LEFT JOIN conn_agg     cn ON cn.company_id = c.id
        LEFT JOIN region_agg   r  ON r.company_id  = c.id
        LEFT JOIN computer_agg co ON co.company_id = c.id
        WHERE c.name LIKE @search AND c.is_active = 1
        ORDER BY c.name
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
      pool.request()
        .input("search", sql.NVarChar, search ? `%${search}%` : "%")
        .query(`SELECT COUNT(*) AS total FROM companies WHERE name LIKE @search AND is_active = 1`),
    ]);

    const formatted = items.recordset.map((r) => ({
      ...r,
      _count: { connections: r.connectionCount, regions: r.regionCount, computers: r.computerCount },
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

    const { name, description, maintenanceStartDate, maintenanceEndDate } = parsed.data;
    const pool = await getPool();

    // Uniqueness check
    const exists = await pool.request()
      .input("name", sql.NVarChar, name)
      .query("SELECT id FROM companies WHERE name = @name AND is_active = 1");
    if (exists.recordset.length > 0) return apiError("Bu firma adı zaten kayıtlı", 409);

    const result = await pool.request()
      .input("name",                 sql.NVarChar, name)
      .input("description",          sql.NVarChar, description || null)
      .input("maintenanceStartDate", sql.Date,     maintenanceStartDate || null)
      .input("maintenanceEndDate",   sql.Date,     maintenanceEndDate   || null)
      .query(`
        INSERT INTO companies (name, description, maintenance_start_date, maintenance_end_date)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.description,
               INSERTED.is_active AS isActive,
               INSERTED.maintenance_start_date AS maintenanceStartDate,
               INSERTED.maintenance_end_date   AS maintenanceEndDate,
               INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
        VALUES (@name, @description, @maintenanceStartDate, @maintenanceEndDate)
      `);

    return apiSuccess(result.recordset[0], 201);
  } catch (error) {
    console.error("[POST /api/companies]", error);
    return apiError("Firma oluşturulamadı", 500);
  }
}
