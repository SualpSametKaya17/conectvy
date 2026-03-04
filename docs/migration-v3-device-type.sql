-- ============================================================
-- Migration V3: Device Type for Computers
-- Conectvy
--
-- SSMS'de çalıştırmadan önce üstteki dropdown'dan
-- doğru veritabanını seçin (örn: ConectvyDB)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'computers')
BEGIN
  RAISERROR('HATA: computers tablosu bulunamadı. Önce migration-v2 scriptini çalıştırın.', 16, 1);
  RETURN;
END
GO

-- ── computers tablosuna device_type kolonu ekle ───────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('computers') AND name = 'device_type'
)
BEGIN
  ALTER TABLE computers
    ADD device_type NVARCHAR(20) NOT NULL DEFAULT 'COMPUTER';
  PRINT 'computers.device_type kolonu eklendi (varsayılan: COMPUTER).';
END
ELSE
  PRINT 'computers.device_type zaten mevcut, atlandı.';
GO

-- ── Kontrol ──────────────────────────────────────────────────
SELECT 'computers kolonları' AS bilgi, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'computers'
  ORDER BY ORDINAL_POSITION;
