import { NextResponse } from 'next/server';
import { requireApiProfile } from '@/lib/auth/api-guards';
import { isAdminRole } from '@/lib/auth/guards';
import { messageSchema } from '@/lib/validators';
import type { Profile } from '@/lib/types';

export async function POST(request: Request) {
  const auth = await requireApiProfile(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = messageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  let sellerId = parsed.data.seller_id || '';
  let ownerId = '';

  if (isAdminRole(auth.profile.role)) {
    if (!sellerId) return NextResponse.json({ error: 'Selecciona un vendedor' }, { status: 400 });
    ownerId = auth.profile.id;
  } else {
    sellerId = auth.profile.id;
    const owner = await auth.admin
      .from('profiles')
      .select('*')
      .in('role', ['owner', 'super_admin'])
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!owner.data) return NextResponse.json({ error: 'No hay dueño activo disponible' }, { status: 400 });
    ownerId = (owner.data as Profile).id;
  }

  const { error } = await auth.admin.from('internal_messages').insert([
    {
      owner_id: ownerId,
      seller_id: sellerId,
      sender_id: auth.profile.id,
      body: parsed.data.body,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
