-- ========================================================
-- ANLIK VIBE CHECK (SENKRONİZE FOTOĞRAF RULETİ) MİGRASYONU
-- ========================================================

-- 1. vibe_checks tablosunu oluştur
CREATE TABLE IF NOT EXISTS vibe_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  initiated_by TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- RLS İzinleri (Herkesin sorgulayabilmesi ve ekleyebilmesi için)
ALTER TABLE vibe_checks ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vibe_checks' AND policyname = 'Public vibe checks'
  ) THEN
    CREATE POLICY "Public vibe checks" ON vibe_checks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. photos tablosuna vibe_check_id ve is_late kolonlarını ekle
ALTER TABLE photos ADD COLUMN IF NOT EXISTS vibe_check_id UUID REFERENCES vibe_checks(id) ON DELETE SET NULL;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE;

-- İndeksler (Hızlı listeleme için)
CREATE INDEX IF NOT EXISTS idx_vibe_checks_room_id ON vibe_checks(room_id);
CREATE INDEX IF NOT EXISTS idx_photos_vibe_check_id ON photos(vibe_check_id);
