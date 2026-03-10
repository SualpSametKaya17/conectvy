/**
 * Manuel migration scripti
 * Kullanım: node scripts/migrate.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env dosyasını yükle
function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= val;
    }
  } catch {
    console.warn(".env dosyası bulunamadı, ortam değişkenleri kullanılıyor.");
  }
}

loadEnv();

const { default: sql } = await import("mssql");

const config = {
  server:   process.env.MSSQL_HOST     ?? "localhost",
  port:     parseInt(process.env.MSSQL_PORT ?? "1433", 10),
  database: process.env.MSSQL_DATABASE ?? "ConectvyDB",
  user:     process.env.MSSQL_USER     ?? "sa",
  password: process.env.MSSQL_PASSWORD ?? "",
  options: {
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
  },
};

const migrations = [
  {
    name: "computers.device_type",
    sql: `IF OBJECT_ID('computers','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('computers') AND name = 'device_type')
           ALTER TABLE computers ADD device_type NVARCHAR(20) NOT NULL DEFAULT 'COMPUTER';`,
  },
  {
    name: "connections.computer_id",
    sql: `IF OBJECT_ID('connections','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('connections') AND name = 'computer_id')
           ALTER TABLE connections ADD computer_id INT NULL REFERENCES computers(id);`,
  },
  {
    name: "companies.maintenance_dates",
    sql: `IF OBJECT_ID('companies','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('companies') AND name = 'maintenance_start_date')
           ALTER TABLE companies ADD maintenance_start_date DATE NULL, maintenance_end_date DATE NULL;`,
  },
  {
    name: "users.email nullable",
    sql: `IF OBJECT_ID('users','U') IS NOT NULL AND
             EXISTS (SELECT 1 FROM sys.columns
                     WHERE object_id = OBJECT_ID('users') AND name = 'email' AND is_nullable = 0)
           ALTER TABLE users ALTER COLUMN email NVARCHAR(255) NULL;`,
  },
  {
    name: "computers.notes",
    sql: `IF OBJECT_ID('computers','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('computers') AND name = 'notes')
           ALTER TABLE computers ADD notes NVARCHAR(MAX) NULL;`,
  },
  {
    name: "users.login_count",
    sql: `IF OBJECT_ID('users','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'login_count')
           ALTER TABLE users ADD login_count INT NOT NULL DEFAULT 0;`,
  },
  {
    name: "users.totp_enabled",
    sql: `IF OBJECT_ID('users','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'totp_enabled')
           ALTER TABLE users ADD totp_enabled BIT NOT NULL DEFAULT 0;`,
  },
  {
    name: "users.totp_secret",
    sql: `IF OBJECT_ID('users','U') IS NOT NULL AND
             NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'totp_secret')
           ALTER TABLE users ADD totp_secret NVARCHAR(255) NULL;`,
  },
  {
    name: "passwords table",
    sql: `IF OBJECT_ID('passwords','U') IS NULL
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
           );`,
  },
];

console.log(`\nBağlanıyor → ${config.server}:${config.port}/${config.database}`);

let pool;
try {
  pool = await sql.connect(config);
  console.log("✓ Bağlantı başarılı\n");
} catch (err) {
  console.error("✗ Bağlantı hatası:", err.message);
  process.exit(1);
}

let ok = 0, skip = 0;
for (const m of migrations) {
  try {
    await pool.request().query(m.sql);
    console.log(`✓ ${m.name}`);
    ok++;
  } catch (err) {
    console.error(`✗ ${m.name}: ${err.message}`);
    skip++;
  }
}

await pool.close();
console.log(`\nTamamlandı: ${ok} başarılı, ${skip} hatalı\n`);
