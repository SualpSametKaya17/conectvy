-- ============================================================
-- Migration V2: Computers & Maintenance Support
-- Conectvy - Çalıştırma: SQL Server Management Studio veya sqlcmd
-- ============================================================

-- 1. companies tablosuna bakım tarihleri ekleniyor
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'companies' AND COLUMN_NAME = 'maintenance_start_date'
)
BEGIN
  ALTER TABLE dbo.companies
    ADD maintenance_start_date DATE NULL,
        maintenance_end_date   DATE NULL;
END
GO

-- 2. computers tablosu oluşturuluyor
IF OBJECT_ID(N'dbo.computers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.computers (
    id          INT IDENTITY(1,1) NOT NULL,
    company_id  INT NOT NULL,
    name        NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    is_active   BIT NOT NULL CONSTRAINT DF_computers_is_active DEFAULT 1,
    created_at  DATETIME2 NOT NULL CONSTRAINT DF_computers_created_at DEFAULT GETDATE(),
    updated_at  DATETIME2 NOT NULL CONSTRAINT DF_computers_updated_at DEFAULT GETDATE(),
    CONSTRAINT PK_computers PRIMARY KEY (id),
    CONSTRAINT FK_computers_companies FOREIGN KEY (company_id)
      REFERENCES dbo.companies (id)
  );
END
GO

-- 3. connections tablosuna computer_id ekleniyor (opsiyonel FK)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'connections' AND COLUMN_NAME = 'computer_id'
)
BEGIN
  ALTER TABLE dbo.connections
    ADD computer_id INT NULL
    CONSTRAINT FK_connections_computers FOREIGN KEY
      REFERENCES dbo.computers (id);
END
GO

-- 4. computers.updated_at için trigger
CREATE OR ALTER TRIGGER dbo.trg_computers_updated_at
ON dbo.computers
AFTER UPDATE
AS
  UPDATE dbo.computers
    SET updated_at = GETDATE()
  WHERE id IN (SELECT id FROM inserted);
GO

-- ============================================================
-- Kontrol sorguları
SELECT 'computers tablosu' AS tablo, COUNT(*) AS kayit FROM dbo.computers;
SELECT 'maintenance_start_date' AS kolon, COLUMN_NAME, DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'companies' AND COLUMN_NAME LIKE 'maintenance%';
SELECT 'computer_id' AS kolon, COLUMN_NAME, DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'connections' AND COLUMN_NAME = 'computer_id';
