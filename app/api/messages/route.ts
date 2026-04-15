import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, isAdminRole } from '@/lib/auth/guards';
import { messageSchema } from '@/lib/validators';
import type { Profile } from '@/lib/types';

export async function POST(request: Request) {
  const actor = await getCurrentProfile();
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const json = await request.json();
  const parsed = messageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  let sellerId = parsed.data.seller_id || '';
  let ownerId = '';

  if (isAdminRole(actor.role)) {
    if (!sellerId) return NextResponse.json({ error: 'Selecciona un vendedor' }, { status: 400 });
    ownerId = actor.id;
  } else {
    sellerId = actor.id;
    const owner = await supabase
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

  const { error } = await supabase.from('internal_messages').insert([
    {
      owner_id: ownerId,
      seller_id: sellerId,
      sender_id: actor.id,
      body: parsed.data.body,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
