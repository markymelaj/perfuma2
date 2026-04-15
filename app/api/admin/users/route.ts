import { NextResponse } from 'next/server';
import { createUserSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/lib/types';

async function deleteUserDeep(userId: string, actorId: string, admin: ReturnType<typeof createAdminClient>) {
  const sales = await admin.from('sales').select('id').or(`seller_id.eq.${userId},created_by.eq.${userId}`);
  const saleIds = (sales.data ?? []).map((row) => row.id as string);
  if (saleIds.length) {
    await admin.from('sales_items').delete().in('sale_id', saleIds);
    await admin.from('sales').delete().in('id', saleIds);
  }

  const reconciliations = await admin
    .from('reconciliations')
    .select('id')
    .or(`seller_id.eq.${userId},created_by.eq.${userId}`);
  const reconciliationIds = (reconciliations.data ?? []).map((row) => row.id as string);
  if (reconciliationIds.length) {
    await admin.from('reconciliation_items').delete().in('reconciliation_id', reconciliationIds);
    await admin.from('reconciliations').delete().in('id', reconciliationIds);
  }

  const consignments = await admin.from('consignments').select('id').eq('seller_id', userId);
  const consignmentIds = (consignments.data ?? []).map((row) => row.id as string);
  if (consignmentIds.length) {
    await admin.from('consignment_items').delete().in('consignment_id', consignmentIds);
    await admin.from('consignments').delete().in('id', consignmentIds);
  }

  await admin.from('internal_messages').delete().or(`seller_id.eq.${userId},sender_id.eq.${userId},owner_id.eq.${userId}`);
  await admin.from('location_pings').delete().eq('user_id', userId);
  await admin.from('audit_logs').delete().eq('actor_id', userId);

  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) {
    throw new Error(deleted.error.message);
  }

  await admin.from('audit_logs').insert([
    {
      actor_id: actorId,
      action: 'DELETE_USER',
      table_name: 'profiles',
      record_id: userId,
      payload: { userId },
    },
  ]);
}

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

  return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
}

export async function DELETE(request: Request) {
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const { userId } = await request.json();
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
  }

  if (userId === auth.profile.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 });
  }

  const target = await auth.admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  const targetRole = (target.data?.role ?? 'seller') as AppRole;

  if (targetRole !== 'seller') {
    return NextResponse.json({ error: 'Por seguridad solo se pueden eliminar vendedores desde el panel' }, { status: 400 });
  }

  try {
    await deleteUserDeep(userId, auth.profile.id, auth.admin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo eliminar el usuario' }, { status: 400 });
  }
}
