import { NextResponse } from 'next/server';
import { createUserSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';
import type { AppRole } from '@/lib/types';

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = createUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  if (auth.profile.role !== 'super_admin' && parsed.data.role !== 'seller') {
    return NextResponse.json({ error: 'Solo super_admin puede crear owners' }, { status: 403 });
  }

  const created = await auth.admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.display_name },
  });

  if (created.error || !created.data.user) {
    return NextResponse.json({ error: created.error?.message ?? 'No se pudo crear el usuario' }, { status: 400 });
  }

  const { error } = await auth.admin
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
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const { action, userId, isActive, password } = await request.json();

  if (action === 'toggle-status') {
    const target = await auth.admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    const targetRole = (target.data?.role ?? 'seller') as AppRole;
    if (auth.profile.role !== 'super_admin' && targetRole !== 'seller') {
      return NextResponse.json({ error: 'Solo super_admin puede modificar owners' }, { status: 403 });
    }

    const { error } = await auth.admin.from('profiles').update({ is_active: Boolean(isActive) }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reset-password') {
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const target = await auth.admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    const targetRole = (target.data?.role ?? 'seller') as AppRole;
    if (auth.profile.role !== 'super_admin' && targetRole !== 'seller') {
      return NextResponse.json({ error: 'Solo super_admin puede resetear owners' }, { status: 403 });
    }

    const updated = await auth.admin.auth.admin.updateUserById(userId, { password });
    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'delete-user') {
    if (userId === auth.profile.id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 });
    }

    const target = await auth.admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    const targetRole = (target.data?.role ?? 'seller') as AppRole;
    if (targetRole !== 'seller') {
      return NextResponse.json({ error: 'Solo puedes eliminar sellers desde este panel' }, { status: 403 });
    }

    await auth.admin.from('location_pings').delete().eq('user_id', userId);
    await auth.admin.from('internal_messages').delete().eq('seller_id', userId);
    await auth.admin.from('internal_messages').delete().eq('sender_id', userId);
    await auth.admin.from('sales').delete().eq('seller_id', userId);
    await auth.admin.from('reconciliations').delete().eq('seller_id', userId);
    await auth.admin.from('consignments').delete().eq('seller_id', userId);

    const deleted = await auth.admin.auth.admin.deleteUser(userId);
    if (deleted.error) {
      return NextResponse.json({ error: deleted.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
}
