import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUserSchema } from '@/lib/validators';
import { getCurrentProfile, isAdminRole } from '@/lib/auth/guards';
import type { AppRole } from '@/lib/types';

export async function POST(request: Request) {
  const actor = await getCurrentProfile();
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const json = await request.json();
  const parsed = createUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  if (actor.role !== 'super_admin' && parsed.data.role !== 'seller') {
    return NextResponse.json({ error: 'Solo super_admin puede crear owners' }, { status: 403 });
  }

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.display_name },
  });

  if (created.error || !created.data.user) {
    return NextResponse.json({ error: created.error?.message ?? 'No se pudo crear el usuario' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.display_name,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      is_active: true,
      must_reenroll_security: false,
    })
    .eq('id', created.data.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: created.data.user.id });
}

export async function PATCH(request: Request) {
  const actor = await getCurrentProfile();
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { action, userId, isActive, password } = await request.json();
  const supabase = await createClient();
  const admin = createAdminClient();

  if (action === 'toggle-status') {
    const target = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    const targetRole = (target.data?.role ?? 'seller') as AppRole;
    if (actor.role !== 'super_admin' && targetRole !== 'seller') {
      return NextResponse.json({ error: 'Solo super_admin puede modificar owners' }, { status: 403 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: Boolean(isActive) })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reset-password') {
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const target = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    const targetRole = (target.data?.role ?? 'seller') as AppRole;
    if (actor.role !== 'super_admin' && targetRole !== 'seller') {
      return NextResponse.json({ error: 'Solo super_admin puede resetear owners' }, { status: 403 });
    }

    const updated = await admin.auth.admin.updateUserById(userId, { password });
    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
}
