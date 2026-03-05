import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/utils";

/** POST /api/connections/:id/connect — last_connected_at güncelle */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isInteger(id) || id <= 0) return apiError("Geçerli bir ID giriniz", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query("UPDATE connections SET last_connected_at = GETDATE() WHERE id = @id; SELECT @@ROWCOUNT AS affected");

  if (!result.recordset[0]?.affected) return apiError("Bağlantı bulunamadı", 404);
  return apiSuccess({ updated: true });
}
