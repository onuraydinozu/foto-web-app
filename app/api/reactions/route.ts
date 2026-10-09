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
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'room_reactions.json');
const TMP_DATA_FILE = path.join('/tmp', 'snaproom_room_reactions.json');
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

async function readReactionsFromStorage(roomId: string): Promise<any[]> {
  // 1. Supabase dene
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('selfie_reactions')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {}

  // 2. R2 dene
  if (s3 && BUCKET_NAME) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `reactions/${roomId}.json`,
      });
      const response = await s3.send(cmd);
      const str = await response.Body?.transformToString();
      if (str) {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err: any) {
      if (err.name !== 'NoSuchKey') {
        console.warn('R2 get reactions error:', err);
      }
    }
  }

  // 3. Fallback FS / In-memory
  const filePath = getUsableFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const all = JSON.parse(content);
      if (all[roomId]) return all[roomId];
    }
  } catch {}

  return inMemoryStore[roomId] || [];
}

async function saveReactionsToStorage(roomId: string, reactions: any[]) {
  inMemoryStore[roomId] = reactions;

  // 1. R2
  if (s3 && BUCKET_NAME) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `reactions/${roomId}.json`,
          Body: JSON.stringify(reactions),
          ContentType: 'application/json',
        })
      );
    } catch (err) {
      console.warn('R2 save reactions error:', err);
    }
  }

  // 2. Local FS
  try {
    const filePath = getUsableFilePath();
    let all: Record<string, any[]> = {};
    if (fs.existsSync(filePath)) {
      try {
        all = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
    }
    all[roomId] = reactions;
    fs.writeFileSync(filePath, JSON.stringify(all, null, 2), 'utf-8');
  } catch {}
}

// GET: Oda veya fotoğraf bazlı selfie reaksiyonlarını getir
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    const photoId = searchParams.get('photoId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId zorunludur' }, { status: 400 });
    }

    const allReactions = await readReactionsFromStorage(roomId);

    // Fotoğraf ID'sine göre grupla
    const grouped: Record<string, any[]> = {};
    for (const item of allReactions) {
      if (!grouped[item.photo_id]) {
        grouped[item.photo_id] = [];
      }
      grouped[item.photo_id].push(item);
    }

    if (photoId) {
      return NextResponse.json({
        reactions: grouped[photoId] || [],
      });
    }

    return NextResponse.json({
      reactions: grouped,
      list: allReactions,
    });
  } catch (error: any) {
    console.error('Selfie reactions GET error:', error);
    return NextResponse.json({ error: error.message || 'Hata' }, { status: 500 });
  }
}

// POST: Yeni selfie reaksiyonu kaydet
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, photoId, userName, selfieData, emoji = '🤪' } = body;

    if (!roomId || !photoId || !selfieData) {
      return NextResponse.json(
        { error: 'roomId, photoId ve selfieData zorunludur' },
        { status: 400 }
      );
    }

    const cleanUserName = (userName || 'Anonim').trim().slice(0, 30);
    const reactionId = `sr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let finalSelfieUrl = selfieData;

    // Eğer Cloudflare R2 yapılandırılmışsa ve selfieData base64 ise, R2'ye yükle
    if (s3 && BUCKET_NAME && typeof selfieData === 'string' && selfieData.startsWith('data:image/')) {
      try {
        const matches = selfieData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = contentType.includes('webp') ? 'webp' : 'jpg';
          const r2Key = `reactions/${roomId}/${reactionId}.${ext}`;

          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: r2Key,
              Body: buffer,
              ContentType: contentType,
            })
          );

          // R2 genel URL'i oluştur veya /api/media proxy'si kullan
          const publicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
          if (publicDomain) {
            const domain = publicDomain.replace(/\/$/, '');
            finalSelfieUrl = `${domain}/${r2Key}`;
          } else {
            finalSelfieUrl = `/api/media?key=${encodeURIComponent(r2Key)}`;
          }
        }
      } catch (uploadErr) {
        console.warn('R2 selfie upload fallback to data URI:', uploadErr);
        // Base64 olarak devam et (150x150 sadece ~12KB)
      }
    }

    const newReaction = {
      id: reactionId,
      room_id: roomId,
      photo_id: photoId,
      user_name: cleanUserName,
      selfie_url: finalSelfieUrl,
      emoji: emoji || '🤪',
      created_at: new Date().toISOString(),
    };

    // 1. Supabase'e ekle
    try {
      const supabase = getSupabase();
      await supabase.from('selfie_reactions').insert({
        room_id: roomId,
        photo_id: photoId,
        user_name: cleanUserName,
        selfie_url: finalSelfieUrl,
        emoji: emoji || '🤪',
      });
    } catch (dbErr) {
      console.warn('Supabase selfie_reactions insert error (using fallback):', dbErr);
    }

    // 2. Fallback Depolamayı Güncelle
    const existing = await readReactionsFromStorage(roomId);
    existing.push(newReaction);
    await saveReactionsToStorage(roomId, existing);

    return NextResponse.json({
      success: true,
      reaction: newReaction,
    });
  } catch (error: any) {
    console.error('Selfie reactions POST error:', error);
    return NextResponse.json({ error: error.message || 'Hata' }, { status: 500 });
  }
}

// DELETE: Selfie reaksiyonunu sil
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const roomId = searchParams.get('roomId');

    if (!id || !roomId) {
      return NextResponse.json({ error: 'id ve roomId zorunludur' }, { status: 400 });
    }

    // 1. Supabase
    try {
      const supabase = getSupabase();
      await supabase.from('selfie_reactions').delete().eq('id', id);
    } catch {}

    // 2. Fallback
    const existing = await readReactionsFromStorage(roomId);
    const filtered = existing.filter((item: any) => item.id !== id);
    await saveReactionsToStorage(roomId, filtered);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Selfie reactions DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Hata' }, { status: 500 });
  }
}
