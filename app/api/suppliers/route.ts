import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(request: Request) {
  await requireAdmin();
  const json = await request.json();
  const parsed = supplierSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('suppliers').insert([{ ...parsed.data }]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
