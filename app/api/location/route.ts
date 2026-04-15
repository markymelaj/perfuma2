import { NextResponse } from 'next/server';
import { locationSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/guards';

export async function POST(request: Request) {
  const actor = await requireProfile();
  const json = await request.json();
  const parsed = locationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('location_pings').insert([
    {
      user_id: actor.id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      note: parsed.data.note || null,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
