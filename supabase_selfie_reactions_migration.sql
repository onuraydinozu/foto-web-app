-- ========================================================
-- CANLI YÜZ REAKSİYONU (SELFIE STICKER) MİGRASYONU
-- ========================================================

-- 1. Selfie Reaksiyonları Tablosu
CREATE TABLE IF NOT EXISTS selfie_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  emoji TEXT DEFAULT '🤪',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS İzinleri
ALTER TABLE selfie_reactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'selfie_reactions' AND policyname = 'Public selfie reactions access'
  ) THEN
    CREATE POLICY "Public selfie reactions access" ON selfie_reactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- İndeksler (Sorgu performansı için)
CREATE INDEX IF NOT EXISTS idx_selfie_reactions_photo_id ON selfie_reactions(photo_id);
CREATE INDEX IF NOT EXISTS idx_selfie_reactions_room_id ON selfie_reactions(room_id);
