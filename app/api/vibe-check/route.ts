import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// R2 S3 Client
let s3: S3Client | null = null;
const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
if (process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(supabaseUrl, supabaseKey);
}

// Fallback FS storage
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'room_vibe_checks.json');
const TMP_DATA_FILE = path.join('/tmp', 'snaproom_vibe_checks.json');
const inMemoryStore: Record<string, any[]> = {};

function getUsableFilePath(): string {
  try {
    const dir = path.dirname(LOCAL_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return LOCAL_DATA_FILE;
  } catch {
    return TMP_DATA_FILE;
  }
}

async function readFromStorage(roomId: string): Promise<any[]> {
  // 1. Supabase dene
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('vibe_checks')
      .select('*')
      .eq('room_id', roomId)
      .order('started_at', { ascending: false });
    if (!error && data && Array.isArray(data)) {
      return data;
    }
  } catch {}

  // 2. R2 dene
  if (s3 && BUCKET_NAME) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `vibe_checks/${roomId}.json`,
      });
      const response = await s3.send(cmd);
      const str = await response.Body?.transformToString();
      if (str) {
        return JSON.parse(str);
      }
    } catch (err: any) {
      if (err.name !== 'NoSuchKey') {
        console.warn('R2 get vibe_check error:', err);
      }
    }
  }

  // 3. Fallback FS / In-memory
  const result: Record<string, any[]> = { ...inMemoryStore };
  for (const filePath of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.assign(result, parsed);
        }
      }
    } catch {}
  }
  return result[roomId] || [];
}

async function saveToStorage(roomId: string, vibeChecks: any[]) {
  // 1. Supabase dene
  try {
    const supabase = getSupabase();
    const latest = vibeChecks[0];
    if (latest) {
      await supabase.from('vibe_checks').upsert({
        id: latest.id,
        room_id: latest.room_id || roomId,
        initiated_by: latest.initiated_by,
        started_at: latest.started_at,
        expires_at: latest.expires_at,
        is_active: latest.is_active,
      });
    }
  } catch {}

  // 2. R2 kalıcı depolama
  if (s3 && BUCKET_NAME) {
    try {
      const cmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `vibe_checks/${roomId}.json`,
        Body: JSON.stringify(vibeChecks),
        ContentType: 'application/json',
      });
      await s3.send(cmd);
    } catch (err) {
      console.warn('R2 save vibe_check error:', err);
    }
  }

  // 3. Fallback FS / In-memory
  const result: Record<string, any[]> = { ...inMemoryStore };
  for (const filePath of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.assign(result, parsed);
        }
      }
    } catch {}
  }
  result[roomId] = vibeChecks;
  Object.assign(inMemoryStore, result);

  try {
    const targetFile = getUsableFilePath();
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, JSON.stringify(result, null, 2), 'utf-8');
  } catch {}
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    if (!roomId) return NextResponse.json({ error: 'roomId zorunludur' }, { status: 400 });

    const checks = await readFromStorage(roomId);
    const now = Date.now();

    // Aktif olan (süresi henüz dolmamış) vibe check
    const active = checks.find((c) => new Date(c.expires_at).getTime() > now) || null;
    const latest = checks[0] || null;

    let canTrigger = true;
    let nextAvailableAt = null;

    if (latest) {
      const lastStartedMs = new Date(latest.started_at).getTime();
      const elapsed = now - lastStartedMs;
      if (elapsed < SIX_HOURS_MS) {
        canTrigger = false;
        nextAvailableAt = new Date(lastStartedMs + SIX_HOURS_MS).toISOString();
      }
    }

    return NextResponse.json({
      activeVibeCheck: active,
      latestVibeCheck: latest,
      allVibeChecks: checks,
      canTrigger,
      nextAvailableAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, roomId, initiatedBy } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId zorunludur' }, { status: 400 });
    }

    if (action === 'trigger') {
      const existing = await readFromStorage(roomId);
      const now = Date.now();

      // 6 saatlik spam koruması kontrolü
      const latest = existing[0];
      if (latest) {
        const lastStartedMs = new Date(latest.started_at).getTime();
        const elapsed = now - lastStartedMs;
        if (elapsed < SIX_HOURS_MS) {
          const remainingMs = SIX_HOURS_MS - elapsed;
          const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
          const remainingHours = Math.floor(remainingMinutes / 60);
          const remMins = remainingMinutes % 60;
          const timeStr = remainingHours > 0 ? `${remainingHours} saat ${remMins} dk` : `${remainingMinutes} dk`;
          return NextResponse.json({
            error: `Spam Koruması: Her 6 saatte en fazla 1 kez Vibe Check patlatılabilir. Kalan süre: ${timeStr}.`,
            remainingMs,
            canTrigger: false,
          }, { status: 429 });
        }
      }

      // 3 dakikalık (180 saniye) Vibe Check başlat
      const newVibeCheck = {
        id: crypto.randomUUID(),
        room_id: roomId,
        initiated_by: initiatedBy || 'Anonim',
        started_at: new Date(now).toISOString(),
        expires_at: new Date(now + 180 * 1000).toISOString(),
        is_active: true,
      };

      const updated = [newVibeCheck, ...existing];
      await saveToStorage(roomId, updated);

      return NextResponse.json({
        success: true,
        vibeCheck: newVibeCheck,
      });
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
