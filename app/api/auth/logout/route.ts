import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Logout signOut exception:', err);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete('havendex_session');

  return response;
}
