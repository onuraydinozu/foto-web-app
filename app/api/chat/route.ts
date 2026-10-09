import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'room_chats.json');
const TMP_DATA_FILE = path.join('/tmp', 'snaproom_room_chats.json');
const inMemoryStore: Record<string, { channels: any[]; messages: any[] }> = {};

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

async function readFromStorage(roomId: string): Promise<{ channels: any[]; messages: any[] }> {
  // 1. Supabase dene
  try {
    const supabase = getSupabase();
    const { data: channels, error: cErr } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (!cErr && channels && channels.length > 0) {
      const channelIds = channels.map((c) => c.id);
      const { data: messages, error: mErr } = await supabase
        .from('chat_messages')
        .select('*')
        .in('channel_id', channelIds)
        .order('created_at', { ascending: true });

      if (!mErr && messages) {
        return { channels, messages };
      }
    }
  } catch {}

  // 2. R2 S3 dene
  if (s3 && BUCKET_NAME) {
    try {
      const cmd = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `chat/${roomId}.json`,
      });
      const response = await s3.send(cmd);
      const str = await response.Body?.transformToString();
      if (str) {
        return JSON.parse(str);
      }
    } catch (err: any) {
      if (err.name !== 'NoSuchKey') {
        console.warn('R2 get chat error:', err);
      }
    }
  }

  // 3. Fallback FS / memory
  const result: Record<string, { channels: any[]; messages: any[] }> = { ...inMemoryStore };
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

  if (result[roomId]) return result[roomId];

  // Varsayılan Genel Masa kanalı
  const defaultChannel = {
    id: `general_${roomId}`,
    room_id: roomId,
    name: 'Genel Masa',
    is_direct: false,
    participants: ['all'],
    wallpaper: 'obsidian',
    created_at: new Date().toISOString(),
  };

  return { channels: [defaultChannel], messages: [] };
}

async function saveToStorage(roomId: string, data: { channels: any[]; messages: any[] }) {
  // R2 kaydet
  if (s3 && BUCKET_NAME) {
    try {
      const cmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `chat/${roomId}.json`,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      });
      await s3.send(cmd);
    } catch (err) {
      console.warn('R2 save chat error:', err);
    }
  }

  // FS / Memory kaydet
  const allData: Record<string, { channels: any[]; messages: any[] }> = { ...inMemoryStore };
  allData[roomId] = data;
  Object.assign(inMemoryStore, allData);

  try {
    const targetFile = getUsableFilePath();
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, JSON.stringify(allData, null, 2), 'utf-8');
  } catch {}
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    if (!roomId) return NextResponse.json({ error: 'roomId zorunludur' }, { status: 400 });

    const chatData = await readFromStorage(roomId);
    return NextResponse.json(chatData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, roomId } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId zorunludur' }, { status: 400 });
    }

    const current = await readFromStorage(roomId);

    // 1. Yeni Mesaj Gönder
    if (action === 'send_message') {
      const { channelId, senderName, text, mediaUrl, mediaType, isBomb, replyToPhotoId } = body;
      const cleanSender = String(senderName || 'Anonim').trim().slice(0, 30);
      const cleanText = String(text || '').slice(0, 1000);

      const newMsg = {
        id: crypto.randomUUID(),
        channel_id: channelId,
        sender_name: cleanSender,
        text: cleanText,
        media_url: mediaUrl || null,
        media_type: mediaType || 'text',
        is_bomb: Boolean(isBomb),
        reply_to_photo_id: replyToPhotoId || null,
        created_at: new Date().toISOString(),
      };

      current.messages.push(newMsg);
      if (current.messages.length > 500) {
        current.messages = current.messages.slice(-500);
      }
      await saveToStorage(roomId, current);

      // Supabase tablosuna da kaydetmeyi dene
      try {
        const supabase = getSupabase();
        await supabase.from('chat_messages').insert({
          id: newMsg.id,
          channel_id: newMsg.channel_id,
          sender_name: newMsg.sender_name,
          text: newMsg.text,
          media_url: newMsg.media_url,
          media_type: newMsg.media_type,
          is_bomb: newMsg.is_bomb,
          reply_to_photo_id: newMsg.reply_to_photo_id,
        });
      } catch {}

      return NextResponse.json({ success: true, message: newMsg });
    }

    // 2. Yeni Kanal Aç (Grup veya 1-e-1 DM)
    if (action === 'create_channel') {
      const { name, isDirect, participants, wallpaper } = body;

      // 1-e-1 ise daha önce açılmış mı kontrol et
      if (isDirect && Array.isArray(participants) && participants.length === 2) {
        const existingDm = current.channels.find(
          (c) => c.is_direct &&
            c.participants?.includes(participants[0]) &&
            c.participants?.includes(participants[1])
        );
        if (existingDm) {
          return NextResponse.json({ success: true, channel: existingDm });
        }
      }

      const newChannel = {
        id: crypto.randomUUID(),
        room_id: roomId,
        name: name || (isDirect ? participants.join(' & ') : 'Yeni Grup'),
        is_direct: Boolean(isDirect),
        participants: participants || [],
        wallpaper: wallpaper || 'obsidian',
        created_at: new Date().toISOString(),
      };

      current.channels.push(newChannel);
      await saveToStorage(roomId, current);

      // Supabase'e kaydetmeyi dene
      try {
        const supabase = getSupabase();
        await supabase.from('chat_channels').insert({
          id: newChannel.id,
          room_id: newChannel.room_id,
          name: newChannel.name,
          is_direct: newChannel.is_direct,
          participants: newChannel.participants,
          wallpaper: newChannel.wallpaper,
        });
      } catch {}

      return NextResponse.json({ success: true, channel: newChannel });
    }

    // 3. Bomba Mesajı Patlat / Sil (Burn After Reading)
    if (action === 'delete_bomb') {
      const { messageId } = body;
      current.messages = current.messages.filter((m) => m.id !== messageId);
      await saveToStorage(roomId, current);

      try {
        const supabase = getSupabase();
        await supabase.from('chat_messages').delete().eq('id', messageId);
      } catch {}

      return NextResponse.json({ success: true, deletedId: messageId });
    }

    // 4. Duvar Kağıdı Değiştir
    if (action === 'set_wallpaper') {
      const { channelId, wallpaper } = body;
      const targetChannel = current.channels.find((c) => c.id === channelId);
      if (targetChannel) {
        targetChannel.wallpaper = wallpaper;
        await saveToStorage(roomId, current);

        try {
          const supabase = getSupabase();
          await supabase.from('chat_channels').update({ wallpaper }).eq('id', channelId);
        } catch {}
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
