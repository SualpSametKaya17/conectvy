import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

/** Araç etiketi → DB değeri (export ile tutarlı) */
const TOOL_LABEL_MAP: Record<string, string> = {
  rustdesk: "RUSTDESK",
  anydesk:  "ANYDESK",
  diğer:    "OTHER",
  other:    "OTHER",
};

function resolveToolValue(label: string): string {
  const key = label.trim().toLowerCase();
  return TOOL_LABEL_MAP[key] ?? label.toUpperCase();
}

interface ImportRow {
  companyName:  string;
  regionName:   string;
  computerName: string;
  name:         string;
  tool:         string;
  remoteId:     string;
  password:     string;
  notes:        string;
}

/** POST /api/connections/import — CSV'den toplu bağlantı oluşturma */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: ImportRow[] = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return apiError("Geçerli satır bulunamadı", 400);
    }

    const pool = await getPool();

    // Mevcut firma / bölge / bilgisayar adlarını ID'ye eşle
    const [companies, regions, computers] = await Promise.all([
      pool.request().query("SELECT id, name FROM companies WHERE is_active = 1"),
      pool.request().query("SELECT id, name FROM regions   WHERE is_active = 1"),
      pool.request().query("SELECT id, name FROM computers WHERE is_active = 1"),
    ]);

    const companyMap  = new Map<string, number>(companies.recordset.map((r) => [r.name.toLowerCase(), r.id]));
    const regionMap   = new Map<string, number>(regions.recordset.map((r)   => [r.name.toLowerCase(), r.id]));
    const computerMap = new Map<string, number>(computers.recordset.map((r) => [r.name.toLowerCase(), r.id]));

    let created = 0, skipped = 0;

    for (const row of rows) {
      const remoteId = row.remoteId?.trim();
      const name     = row.name?.trim() || remoteId;
      if (!remoteId) { skipped++; continue; }

      const toolValue  = resolveToolValue(row.tool || "OTHER");
      const companyId  = row.companyName  ? (companyMap.get(row.companyName.toLowerCase())   ?? null) : null;
      const regionId   = row.regionName   ? (regionMap.get(row.regionName.toLowerCase())     ?? null) : null;
      const computerId = row.computerName ? (computerMap.get(row.computerName.toLowerCase()) ?? null) : null;

      try {
        await pool.request()
          .input("name",       sql.NVarChar, name)
          .input("tool",       sql.NVarChar, toolValue)
          .input("remoteId",   sql.NVarChar, remoteId)
          .input("password",   sql.NVarChar, row.password || null)
          .input("companyId",  sql.Int,      companyId)
          .input("regionId",   sql.Int,      regionId)
          .input("computerId", sql.Int,      computerId)
          .input("notes",      sql.NVarChar, row.notes || null)
          .query(`
            INSERT INTO connections (name, tool, remote_id, password, company_id, region_id, computer_id, notes)
            VALUES (@name, @tool, @remoteId, @password, @companyId, @regionId, @computerId, @notes)
          `);
        created++;
      } catch {
        skipped++;
      }
    }

    return apiSuccess({ created, skipped });
  } catch (error) {
    console.error("[POST /api/connections/import]", error);
    return apiError("İçe aktarma başarısız", 500);
  }
}
