import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

async function createRouteSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // ignore in route handlers
          }
        },
      },
    },
  );
}

async function getProfileById(profileId: string) {
  const admin = createAdminClient();
  const profileResult = await admin.from('profiles').select('*').eq('id', profileId).maybeSingle();
  return {
    admin,
    profile: (profileResult.data as Profile | null) ?? null,
    error: profileResult.error,
  };
}

export async function getApiProfile(request: Request): Promise<ApiAuthSuccess | ApiAuthFailure> {
  const actorId = request.headers.get('x-actor-id');
  if (actorId) {
    const actor = await getProfileById(actorId);
    if (actor.error || !actor.profile) {
      return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }
    if (!actor.profile.is_active) {
      return { response: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }) };
    }
    return { profile: actor.profile, admin: actor.admin };
  }

  const routeClient = await createRouteSupabaseClient();
  const cookieUserResult = await routeClient.auth.getUser();
  if (!cookieUserResult.error && cookieUserResult.data.user) {
    const actor = await getProfileById(cookieUserResult.data.user.id);
    if (actor.error || !actor.profile) {
      return { response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) };
    }
    if (!actor.profile.is_active) {
      return { response: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }) };
    }
    return { profile: actor.profile, admin: actor.admin };
  }

  const token = getBearerToken(request);
  if (token) {
    const tokenUserResult = await routeClient.auth.getUser(token);
    if (!tokenUserResult.error && tokenUserResult.data.user) {
      const actor = await getProfileById(tokenUserResult.data.user.id);
      if (actor.error || !actor.profile) {
        return { response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) };
      }
      if (!actor.profile.is_active) {
        return { response: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }) };
      }
      return { profile: actor.profile, admin: actor.admin };
    }
  }

  return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
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
