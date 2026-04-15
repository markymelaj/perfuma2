import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/validators';
import { getHeaderAdminContext } from '@/lib/auth/admin-header-context';

export async function POST(request: Request) {
  const ctx = await getHeaderAdminContext(request);
  if ('error' in ctx) return ctx.error;

  const json = await request.json();
  const parsed = supplierSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const { error } = await ctx.admin.from('suppliers').insert([
    {
      name: parsed.data.name,
      contact_name: parsed.data.contact_name || null,
      contact_phone: parsed.data.contact_phone || null,
      notes: parsed.data.notes || null,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
