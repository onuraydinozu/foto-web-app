-- ========================================================
-- KAPSÜL SOHBET, FISILTI VE KAOS ODALARI MİGRASYONU
-- ========================================================

-- 1. Sohbet Odaları / Kanalları (Genel Masa, Mini Grup veya 1-e-1 Fısıltı)
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT, -- Boşsa veya rumuzsa 1-e-1 DM'dir
  is_direct BOOLEAN DEFAULT FALSE,
  participants TEXT[] NOT NULL, -- Katılımcı rumuzları: ['onur', 'efe']
  wallpaper TEXT DEFAULT 'obsidian',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Mesajlar Tablosu
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  text TEXT,
  media_url TEXT, -- R2 dosya yolu veya Base64
  media_type TEXT DEFAULT 'text', -- 'text', 'image', 'audio', 'video'
  is_bomb BOOLEAN DEFAULT FALSE, -- Bomba mesaj mı? (Okunduktan 5 sn sonra silinir)
  reply_to_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS İzinleri
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_channels' AND policyname = 'Public chat access'
  ) THEN
    CREATE POLICY "Public chat access" ON chat_channels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Public messages access'
  ) THEN
    CREATE POLICY "Public messages access" ON chat_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_chat_channels_room_id ON chat_channels(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);
