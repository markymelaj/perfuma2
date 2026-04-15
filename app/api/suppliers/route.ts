import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = supplierSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const { error } = await auth.admin.from('suppliers').insert([
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
