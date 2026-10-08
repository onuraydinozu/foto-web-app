import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { id, spotify_url } = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('rooms')
      .update({ spotify_url })
      .eq('id', id);
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
  }
}
