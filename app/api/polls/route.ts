import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'room_polls.json');
const TMP_DATA_FILE = path.join('/tmp', 'snaproom_room_polls.json');

// In-memory fallback
const inMemoryPolls: Record<string, any[]> = {};

function getUsableFilePath(): string {
  try {
    const dir = path.dirname(LOCAL_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.accessSync(dir, fs.constants.W_OK);
    return LOCAL_DATA_FILE;
  } catch {
    return TMP_DATA_FILE;
  }
}

function getAllRoomPolls(): Record<string, any[]> {
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

  return result;
}

function saveAllRoomPolls(data: Record<string, any[]>): void {
  Object.assign(inMemoryPolls, data);

  try {
    const targetFile = getUsableFilePath();
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Sunucusuz ortamda anket dosyası yazılamadı, bellek içi saklanıyor:', e);
  }
}

// GET /api/polls?roomId=xyz
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ polls: [] });
    }

    const allPolls = getAllRoomPolls();
    const polls = allPolls[roomId] || [];

    return NextResponse.json({ polls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, polls: [] }, { status: 500 });
  }
}

// POST /api/polls (body: { roomId, polls })
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, polls } = body;

    if (!roomId || !Array.isArray(polls)) {
      return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 });
    }

    const allPolls = getAllRoomPolls();
    allPolls[roomId] = polls;
    saveAllRoomPolls(allPolls);

    return NextResponse.json({ success: true, polls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
