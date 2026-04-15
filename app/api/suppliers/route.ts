import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/validators';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@/lib/types';

async function getAdminContext(request: Request) {
  const adminId = request.headers.get('x-admin-id');
  const admin = createAdminClient();

  if (!adminId) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  const profileResult = await admin
    .from('profiles')
    .select('*')
    .eq('id', adminId)
    .maybeSingle();

  const profile = (profileResult.data as Profile | null) ?? null;

  if (profileResult.error || !profile) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  if (!profile.is_active) {
    return {
      error: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }),
    };
  }

  if (!['super_admin', 'owner'].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
    };
  }

  return { profile, admin };
}

export async function POST(request: Request) {
  const ctx = await getAdminContext(request);
  if ('error' in ctx) return ctx.error;

  const json = await request.json();
  const parsed = supplierSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const { error } = await ctx.admin.from('suppliers').insert([
    {
      name: parsed.data.name,
      contact_name: parsed.data.contact_name || null,
      contact_phone: parsed.data.contact_phone || null,
      notes: parsed.data.notes || null,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
