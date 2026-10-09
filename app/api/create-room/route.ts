import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { short_id, pin_hash, is_disposable_mode, is_unlocked, location, spotify_url, upload_locked_at } = await req.json();

    if (!short_id) {
      return NextResponse.json({ error: 'short_id is required' }, { status: 400 });
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        short_id,
        pin_hash: pin_hash || short_id,
        is_disposable_mode: is_disposable_mode ?? false,
        is_unlocked: is_unlocked ?? true,
        location: location || "Günün Ortak Dump'ı ✨",
        spotify_url: spotify_url || '',
        upload_locked_at: upload_locked_at || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase create room error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    console.error('Create room API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create room' }, { status: 500 });
  }
}
