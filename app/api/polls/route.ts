import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// R2 (S3) Client setup
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

// Fallback logic for Local/FS
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'room_polls.json');
const TMP_DATA_FILE = path.join('/tmp', 'snaproom_room_polls.json');
const inMemoryPolls: Record<string, any[]> = {};

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

async function readFromFallback(roomId: string) {
  const result: Record<string, any[]> = { ...inMemoryPolls };
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

async function saveToFallback(roomId: string, polls: any[]) {
  const result: Record<string, any[]> = { ...inMemoryPolls };
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
  result[roomId] = polls;
  Object.assign(inMemoryPolls, result);

  try {
    const targetFile = getUsableFilePath();
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, JSON.stringify(result, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Fallback save failed:', e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    if (!roomId) return NextResponse.json({ polls: [] });

    // R2 kalıcı depolama 
    if (s3 && BUCKET_NAME) {
      try {
        const cmd = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `polls/${roomId}.json`
        });
        const response = await s3.send(cmd);
        const str = await response.Body?.transformToString();
        if (str) {
          const polls = JSON.parse(str);
          return NextResponse.json({ polls });
        }
      } catch (err: any) {
        if (err.name !== 'NoSuchKey') {
          console.warn('R2 get error:', err);
        }
      }
    }

    // R2'de yoksa veya ayarlanmamışsa fallback
    const polls = await readFromFallback(roomId);
    return NextResponse.json({ polls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, polls: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, polls } = body;

    if (!roomId || !Array.isArray(polls)) {
      return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 });
    }

    if (s3 && BUCKET_NAME) {
      try {
        const cmd = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `polls/${roomId}.json`,
          Body: JSON.stringify(polls),
          ContentType: 'application/json',
        });
        await s3.send(cmd);
        return NextResponse.json({ success: true, polls });
      } catch (err: any) {
        console.warn('R2 put error:', err);
      }
    }

    // S3/R2 başarısız olursa fallback
    await saveToFallback(roomId, polls);
    return NextResponse.json({ success: true, polls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
