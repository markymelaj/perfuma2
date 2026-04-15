import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminRole } from '@/lib/auth/guards';
import type { AppRole, Profile } from '@/lib/types';

type ApiAuthSuccess = { profile: Profile; admin: ReturnType<typeof createAdminClient> };
type ApiAuthFailure = { response: NextResponse };

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim();
}

export async function getApiProfile(request: Request): Promise<ApiAuthSuccess | ApiAuthFailure> {
  const token = getBearerToken(request);
  if (!token) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const userResult = await admin.auth.getUser(token);
  const user = userResult.data.user;

  if (userResult.error || !user) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const profileResult = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile = (profileResult.data as Profile | null) ?? null;

  if (profileResult.error || !profile) {
    return { response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) };
  }

  if (!profile.is_active) {
    return { response: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }) };
  }

  return { profile, admin };
}

export async function requireApiProfile(request: Request): Promise<ApiAuthSuccess | ApiAuthFailure> {
  return getApiProfile(request);
}

export async function requireApiAdmin(request: Request): Promise<ApiAuthSuccess | ApiAuthFailure> {
  const result = await getApiProfile(request);
  if ('response' in result) return result;

  if (!isAdminRole(result.profile.role as AppRole)) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return result;
}
