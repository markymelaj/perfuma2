import { NextResponse } from 'next/server';
import { createUserSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';
import type { AppRole } from '@/lib/types';

async function deleteUserDeep(auth: Awaited<ReturnType<typeof requireApiAdmin>>, userId: string) {
  if ('response' in auth) return auth.response;
  const admin = auth.admin;

  const consignmentsRes = await admin.from('consignments').select('id').eq('seller_id', userId);
  const consignmentIds = (consignmentsRes.data ?? []).map((row) => row.id);

  if (consignmentIds.length > 0) {
    const salesRes = await admin.from('sales').select('id').in('consignment_id', consignmentIds);
    const saleIds = (salesRes.data ?? []).map((row) => row.id);
    if (saleIds.length > 0) {
      await admin.from('sales_items').delete().in('sale_id', saleIds);
      await admin.from('sales').delete().in('id', saleIds);
    }

    const reconciliationsRes = await admin.from('reconciliations').select('id').in('consignment_id', consignmentIds);
    const reconciliationIds = (reconciliationsRes.data ?? []).map((row) => row.id);
    if (reconciliationIds.length > 0) {
      await admin.from('reconciliation_items').delete().in('reconciliation_id', reconciliationIds);
      await admin.from('reconciliations').delete().in('id', reconciliationIds);
    }

    await admin.from('consignment_items').delete().in('consignment_id', consignmentIds);
    await admin.from('consignments').delete().in('id', consignmentIds);
  }

  await admin.from('internal_messages').delete().or(`seller_id.eq.${userId},owner_id.eq.${userId},sender_id.eq.${userId}`);
  await admin.from('location_pings').delete().eq('user_id', userId);
  await admin.from('audit_logs').delete().eq('actor_id', userId);

  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) {
    return NextResponse.json({ error: deleted.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
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

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
  }

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
    const target = await auth.admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    const targetRole = (target.data?.role ?? 'seller') as AppRole;
    if (auth.profile.role !== 'super_admin' && targetRole !== 'seller') {
      return NextResponse.json({ error: 'Solo super_admin puede eliminar owners' }, { status: 403 });
    }
    if (auth.profile.id === userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario desde aquí' }, { status: 400 });
    }

    return deleteUserDeep(auth, userId);
  }

  return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
}
