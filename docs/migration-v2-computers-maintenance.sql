-- ============================================================
-- Migration V2: Computers & Maintenance Support
-- Conectvy - Çalıştırma: SQL Server Management Studio veya sqlcmd
-- ============================================================

-- 1. companies tablosuna bakım tarihleri ekleniyor
ALTER TABLE companies
  ADD maintenance_start_date DATE NULL,
      maintenance_end_date   DATE NULL;
GO

-- 2. computers tablosu oluşturuluyor
CREATE TABLE computers (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id),
  name        NVARCHAR(255) NOT NULL,
  description NVARCHAR(1000) NULL,
  is_active   BIT NOT NULL DEFAULT 1,
  created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at  DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- 3. connections tablosuna computer_id ekleniyor (opsiyonel FK)
ALTER TABLE connections
  ADD computer_id INT NULL REFERENCES computers(id);
GO

-- 4. computers.updated_at için trigger
CREATE OR ALTER TRIGGER trg_computers_updated_at
ON computers
AFTER UPDATE
AS
  UPDATE computers
    SET updated_at = GETDATE()
  WHERE id IN (SELECT id FROM inserted);
GO

-- ============================================================
-- Kontrol sorguları
SELECT 'computers tablosu' AS tablo, COUNT(*) AS kayit FROM computers;
SELECT 'maintenance_start_date' AS kolon, * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'companies' AND COLUMN_NAME LIKE 'maintenance%';
SELECT 'computer_id' AS kolon, * FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'connections' AND COLUMN_NAME = 'computer_id';
