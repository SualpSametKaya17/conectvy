import sql from "mssql";

// ─── Config ───────────────────────────────────────────────────────────────────
const config: sql.config = {
  server:   process.env.MSSQL_HOST     ?? "localhost",
  port:     parseInt(process.env.MSSQL_PORT ?? "1433", 10),
  database: process.env.MSSQL_DATABASE ?? "ConectvyDB",
  user:     process.env.MSSQL_USER     ?? "sa",
  password: process.env.MSSQL_PASSWORD ?? "",
  options: {
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

// ─── Singleton pool (Next.js hot-reload güvenli) ──────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var _mssqlPool: sql.ConnectionPool | undefined;
}

async function getPool(): Promise<sql.ConnectionPool> {
  if (global._mssqlPool?.connected) return global._mssqlPool;

  const pool = new sql.ConnectionPool(config);
  await pool.connect();

  if (process.env.NODE_ENV !== "production") {
    global._mssqlPool = pool;
  }

  return pool;
}

export { sql, getPool };
