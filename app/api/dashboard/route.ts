import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

/**
 * GET /api/dashboard
 */
export async function GET() {
  try {
    const pool = await getPool();

    const [stats, recent, tools] = await Promise.all([
      // Stat counts
      pool.request().query<{
        totalConnections: number;
        activeConnections: number;
        totalCompanies: number;
        totalRegions: number;
        totalComputers: number;
      }>(`
        SELECT
          (SELECT COUNT(*) FROM connections)                          AS totalConnections,
          (SELECT COUNT(*) FROM connections WHERE is_active = 1)      AS activeConnections,
          (SELECT COUNT(*) FROM companies   WHERE is_active = 1)      AS totalCompanies,
          (SELECT COUNT(*) FROM regions     WHERE is_active = 1)      AS totalRegions,
          (SELECT COUNT(*) FROM computers   WHERE is_active = 1)      AS totalComputers
      `),

      // Son 5 bağlantı
      pool.request().query(`
        SELECT TOP 5
          c.id, c.name, c.tool, c.remote_id AS remoteId, c.updated_at AS updatedAt,
          co.id AS companyId, co.name AS companyName,
          r.id  AS regionId,  r.name  AS regionName
        FROM connections c
        LEFT JOIN companies co ON co.id = c.company_id
        LEFT JOIN regions   r  ON r.id  = c.region_id
        WHERE c.is_active = 1
        ORDER BY c.updated_at DESC
      `),

      // Araç dağılımı
      pool.request().query(`
        SELECT tool, COUNT(*) AS cnt
        FROM connections
        WHERE is_active = 1
        GROUP BY tool
      `),
    ]);

    const s = stats.recordset[0];

    const recentConnections = recent.recordset.map((row) => ({
      id:        row.id,
      name:      row.name,
      tool:      row.tool,
      remoteId:  row.remoteId,
      updatedAt: row.updatedAt,
      company:   row.companyId ? { id: row.companyId, name: row.companyName } : null,
      region:    row.regionId  ? { id: row.regionId,  name: row.regionName  } : null,
    }));

    const toolStats = tools.recordset.map((row) => ({
      tool:  row.tool,
      count: row.cnt,
    }));

    return apiSuccess({
      stats: {
        totalConnections:  s.totalConnections,
        activeConnections: s.activeConnections,
        totalCompanies:    s.totalCompanies,
        totalRegions:      s.totalRegions,
        totalComputers:    s.totalComputers,
      },
      recentConnections,
      toolStats,
    });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return apiError("Veriler alınamadı", 500);
  }
}
