import { NextResponse } from 'next/server';
import { productSchema } from '@/lib/validators';
import { getHeaderAdminContext } from '@/lib/auth/admin-header-context';

export async function POST(request: Request) {
  const ctx = await getHeaderAdminContext(request);
  if ('error' in ctx) return ctx.error;

  const json = await request.json();
  const parsed = productSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const { error } = await ctx.admin.from('products').insert([
    {
      sku: parsed.data.sku || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      default_sale_price: parsed.data.default_sale_price,
    },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
