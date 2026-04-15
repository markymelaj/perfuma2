import { NextResponse } from 'next/server';
import { productSchema } from '@/lib/validators';
import { requireApiAdmin } from '@/lib/auth/api-guards';

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if ('response' in auth) return auth.response;

  const json = await request.json();
  const parsed = productSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const { error } = await auth.admin.from('products').insert([
    {
      sku: parsed.data.sku || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      default_sale_price: 0,
      supplier_id: null,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
