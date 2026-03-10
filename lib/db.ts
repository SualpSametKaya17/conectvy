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

  // Otomatik şema güncellemeleri (idempotent)
  try {
    await pool.request().query(`
      IF OBJECT_ID('computers','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('computers') AND name = 'device_type')
        ALTER TABLE computers ADD device_type NVARCHAR(20) NOT NULL DEFAULT 'COMPUTER';
    `);
  } catch {
    // Hata olursa sessizce geç — tablo henüz oluşturulmamış olabilir
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('connections','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('connections') AND name = 'computer_id')
        ALTER TABLE connections ADD computer_id INT NULL REFERENCES computers(id);
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('companies','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('companies') AND name = 'maintenance_start_date')
        ALTER TABLE companies
          ADD maintenance_start_date DATE NULL,
              maintenance_end_date   DATE NULL;
    `);
  } catch {
    // Hata olursa sessizce geç — kolonlar zaten mevcut olabilir
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('computers','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('computers') AND name = 'notes')
        ALTER TABLE computers ADD notes NVARCHAR(MAX) NULL;
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('users','U') IS NOT NULL AND
         EXISTS (SELECT 1 FROM sys.columns
                 WHERE object_id = OBJECT_ID('users') AND name = 'email' AND is_nullable = 0)
        ALTER TABLE users ALTER COLUMN email NVARCHAR(255) NULL;
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('users','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'login_count')
        ALTER TABLE users ADD login_count INT NOT NULL DEFAULT 0;
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('users','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'totp_enabled')
        ALTER TABLE users ADD totp_enabled BIT NOT NULL DEFAULT 0;
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('users','U') IS NOT NULL AND
         NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'totp_secret')
        ALTER TABLE users ADD totp_secret NVARCHAR(255) NULL;
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  try {
    await pool.request().query(`
      IF OBJECT_ID('passwords','U') IS NULL
        CREATE TABLE passwords (
          id         INT IDENTITY(1,1) PRIMARY KEY,
          title      NVARCHAR(255)  NOT NULL,
          username   NVARCHAR(255)  NULL,
          password   NVARCHAR(1000) NULL,
          url        NVARCHAR(500)  NULL,
          category   NVARCHAR(50)   NULL DEFAULT 'Genel',
          notes      NVARCHAR(MAX)  NULL,
          is_active  BIT            NOT NULL DEFAULT 1,
          created_at DATETIME2      NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2      NOT NULL DEFAULT GETDATE()
        );
    `);
  } catch {
    // Hata olursa sessizce geç
  }

  // ── Performance indexes (idempotent) ─────────────────────────────────────
  const indexes: [string, string][] = [
    [
      "IX_companies_name_active",
      "CREATE INDEX IX_companies_name_active ON companies(name) WHERE is_active = 1",
    ],
    [
      "IX_regions_company_name",
      "CREATE INDEX IX_regions_company_name ON regions(company_id, name)",
    ],
    [
      "IX_computers_company_active",
      "CREATE INDEX IX_computers_company_active ON computers(company_id, name) WHERE is_active = 1",
    ],
    [
      "IX_connections_company_active",
      "CREATE INDEX IX_connections_company_active ON connections(company_id) WHERE is_active = 1",
    ],
    [
      "IX_connections_computer_active",
      "CREATE INDEX IX_connections_computer_active ON connections(computer_id, tool) WHERE is_active = 1",
    ],
  ];

  for (const [name, ddl] of indexes) {
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${name}')
          ${ddl};
      `);
    } catch {
      // İndex zaten varsa veya tablo henüz oluşturulmamışsa sessizce geç
    }
  }

  if (process.env.NODE_ENV !== "production") {
    global._mssqlPool = pool;
  }

  return pool;
}

export { sql, getPool };
