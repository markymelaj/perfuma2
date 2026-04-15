import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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

function getRequestCookies(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (!cookieHeader) return [];

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=');
      const name = index >= 0 ? part.slice(0, index) : part;
      const value = index >= 0 ? part.slice(index + 1) : '';
      return {
        name: decodeURIComponent(name),
        value: decodeURIComponent(value),
      };
    });
}

function createRouteSupabaseClient(request: Request) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return getRequestCookies(request);
        },
        setAll() {
          // no-op en route handlers para este flujo
        },
      },
    },
  );
}

async function resolveUserId(request: Request) {
  const routeClient = createRouteSupabaseClient(request);

  const cookieUserResult = await routeClient.auth.getUser();
  if (!cookieUserResult.error && cookieUserResult.data.user) {
    return cookieUserResult.data.user.id;
  }

  const token = getBearerToken(request);
  if (token) {
    const tokenUserResult = await routeClient.auth.getUser(token);
    if (!tokenUserResult.error && tokenUserResult.data.user) {
      return tokenUserResult.data.user.id;
    }
  }

  return null;
}

export async function getApiProfile(request: Request): Promise<ApiAuthSuccess | ApiAuthFailure> {
  const userId = await resolveUserId(request);

  if (!userId) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const admin = createAdminClient();

  const profileResult = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
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
