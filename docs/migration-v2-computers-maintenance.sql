-- ============================================================
-- Migration V2: Computers & Maintenance Support
-- Conectvy
--
-- SSMS'de çalıştırmadan önce üstteki dropdown'dan
-- doğru veritabanını seçin (örn: ConectvyDB)
-- ============================================================

-- Doğru veritabanında olduğumuzu kontrol et
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'companies')
BEGIN
  RAISERROR('HATA: companies tablosu bulunamadı. Lütfen SSMS üstteki açılır menüden doğru veritabanını seçin (ConectvyDB).', 16, 1);
  RETURN;
END
GO

-- ── 1. companies tablosuna bakım tarihleri ───────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'maintenance_start_date'
)
BEGIN
  ALTER TABLE companies
    ADD maintenance_start_date DATE NULL,
        maintenance_end_date   DATE NULL;
  PRINT 'companies: maintenance tarihleri eklendi.';
END
ELSE
  PRINT 'companies: maintenance tarihleri zaten mevcut, atlandı.';
GO

-- ── 2. computers tablosunu oluştur (FK OLMADAN) ──────────────
IF OBJECT_ID('computers', 'U') IS NULL
BEGIN
  CREATE TABLE computers (
    id          INT IDENTITY(1,1) NOT NULL,
    company_id  INT NOT NULL,
    name        NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    is_active   BIT NOT NULL DEFAULT 1,
    created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_computers PRIMARY KEY (id)
  );
  PRINT 'computers tablosu oluşturuldu.';
END
ELSE
  PRINT 'computers tablosu zaten mevcut, atlandı.';
GO

-- ── 3. computers → companies FK (ayrı adımda) ───────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_computers_companies'
)
BEGIN
  ALTER TABLE computers
    ADD CONSTRAINT FK_computers_companies
    FOREIGN KEY (company_id) REFERENCES companies (id);
  PRINT 'FK_computers_companies eklendi.';
END
ELSE
  PRINT 'FK_computers_companies zaten mevcut, atlandı.';
GO

-- ── 4. connections tablosuna computer_id ekle ────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('connections') AND name = 'computer_id'
)
BEGIN
  ALTER TABLE connections
    ADD computer_id INT NULL;
  PRINT 'connections.computer_id kolonu eklendi.';
END
ELSE
  PRINT 'connections.computer_id zaten mevcut, atlandı.';
GO

-- ── 5. connections → computers FK (ayrı adımda) ─────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_connections_computers'
)
BEGIN
  ALTER TABLE connections
    ADD CONSTRAINT FK_connections_computers
    FOREIGN KEY (computer_id) REFERENCES computers (id);
  PRINT 'FK_connections_computers eklendi.';
END
ELSE
  PRINT 'FK_connections_computers zaten mevcut, atlandı.';
GO

-- ── 6. computers.updated_at trigger ─────────────────────────
CREATE OR ALTER TRIGGER trg_computers_updated_at
ON computers
AFTER UPDATE
AS
  UPDATE computers
    SET updated_at = GETDATE()
  WHERE id IN (SELECT id FROM inserted);
GO
PRINT 'trg_computers_updated_at trigger oluşturuldu.';
GO

-- ── Kontrol ──────────────────────────────────────────────────
SELECT 'Tablo listesi' AS bilgi, name FROM sys.tables ORDER BY name;

SELECT 'computers kolonları' AS bilgi, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'computers';

SELECT 'FK listesi' AS bilgi, name AS fk_name, OBJECT_NAME(parent_object_id) AS tablo
  FROM sys.foreign_keys
  WHERE name IN ('FK_computers_companies', 'FK_connections_computers');
