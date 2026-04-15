import { NextResponse } from 'next/server';
import { productSchema } from '@/lib/validators';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(request: Request) {
  await requireAdmin();
  const json = await request.json();
  const parsed = productSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('products').insert([
    {
      ...parsed.data,
      supplier_id: parsed.data.supplier_id || null,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
    },
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
