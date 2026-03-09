import { NextResponse } from "next/server";
import sql from "mssql";

export async function POST(req: Request) {
  const { host, port, database, user, password, trustServerCertificate } =
    await req.json();

  if (!host || !database || !user) {
    return NextResponse.json(
      { connected: false, error: "Host, veritabanı ve kullanıcı adı zorunludur" },
      { status: 400 }
    );
  }

  const pool = new sql.ConnectionPool({
    server: host,
    port: parseInt(port ?? "1433", 10),
    database,
    user,
    password: password ?? "",
    options: {
      trustServerCertificate:
        trustServerCertificate === "true" || trustServerCertificate === true,
      enableArithAbort: true,
      connectTimeout: 8000,
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
  });

  try {
    await pool.connect();
    await pool.request().query("SELECT 1 AS test");
    await pool.close();
    return NextResponse.json({ connected: true });
  } catch (err) {
    try { await pool.close(); } catch {}
    return NextResponse.json({ connected: false, error: String(err) });
  }
}
