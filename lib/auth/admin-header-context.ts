import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@/lib/types';

export async function getHeaderAdminContext(request: Request) {
  const adminId = request.headers.get('x-admin-id');
  const admin = createAdminClient();

  if (!adminId) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    } as const;
  }

  const profileResult = await admin.from('profiles').select('*').eq('id', adminId).maybeSingle();
  const profile = (profileResult.data as Profile | null) ?? null;

  if (profileResult.error || !profile) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    } as const;
  }

  if (!profile.is_active) {
    return {
      error: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }),
    } as const;
  }

  if (!['super_admin', 'owner'].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
    } as const;
  }

  return { profile, admin } as const;
}
