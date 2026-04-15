import { NextResponse } from 'next/server';
import { locationSchema } from '@/lib/validators';
import { requireApiProfile } from '@/lib/auth/api-guards';

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = locationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const { error } = await auth.admin.from('location_pings').insert([
    {
      user_id: auth.profile.id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      note: parsed.data.note || null,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
