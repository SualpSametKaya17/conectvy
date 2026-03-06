import { getPool, sql } from "@/lib/db";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreatePasswordSchema } from "@/lib/validations/password";
import { encrypt } from "@/lib/crypto";

/** GET /api/passwords */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search")   ?? "";
  const category = searchParams.get("category") ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "10", 10));
  const offset   = (page - 1) * pageSize;

  const pool = await getPool();
  const req2 = pool.request()
    .input("search",   sql.NVarChar, `%${search}%`)
    .input("offset",   sql.Int,      offset)
    .input("pageSize", sql.Int,      pageSize);

  let where = "is_active = 1";
  if (search)   where += " AND (title LIKE @search OR username LIKE @search OR url LIKE @search OR notes LIKE @search)";
  if (category) { where += " AND category = @category"; req2.input("category", sql.NVarChar, category); }

  const [items, counts] = await Promise.all([
    req2.query(`
      SELECT id, title, username, url, category, notes,
             created_at AS createdAt, updated_at AS updatedAt
      FROM passwords
      WHERE ${where}
      ORDER BY title
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    pool.request()
      .input("search",   sql.NVarChar, `%${search}%`)
      .input("category", sql.NVarChar, category || null)
      .query(`
        SELECT COUNT(*) AS total FROM passwords
        WHERE is_active = 1
          ${search   ? "AND (title LIKE @search OR username LIKE @search OR url LIKE @search OR notes LIKE @search)" : ""}
          ${category ? "AND category = @category" : ""}
      `),
  ]);

  return apiSuccess({
    items:    items.recordset,
    total:    counts.recordset[0]?.total ?? 0,
    page,
    pageSize,
  });
}

/** POST /api/passwords */
export async function POST(req: Request) {
  const body   = await req.json();
  const parsed = CreatePasswordSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { title, username, password, url, category, notes } = parsed.data;

  // Şifreyi çift katmanlı şifrele (boşsa null bırak)
  const encryptedPassword = password ? encrypt(password) : null;

  const pool = await getPool();
  const result = await pool.request()
    .input("title",    sql.NVarChar, title)
    .input("username", sql.NVarChar, username  || null)
    .input("password", sql.NVarChar, encryptedPassword)
    .input("url",      sql.NVarChar, url       || null)
    .input("category", sql.NVarChar, category  || "Genel")
    .input("notes",    sql.NVarChar, notes     || null)
    .query(`
      INSERT INTO passwords (title, username, password, url, category, notes)
      OUTPUT INSERTED.id, INSERTED.title, INSERTED.username, INSERTED.url,
             INSERTED.category, INSERTED.notes,
             INSERTED.created_at AS createdAt, INSERTED.updated_at AS updatedAt
      VALUES (@title, @username, @password, @url, @category, @notes)
    `);

  return apiSuccess(result.recordset[0], 201);
}
