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

function getActorIdHeader(request: Request) {
  return request.headers.get('x-actor-id')?.trim() || null;
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // no-op en route handlers
          }
        },
      },
    },
  );
}

async function resolveUserId(request: Request) {
  const admin = createAdminClient();
  const token = getBearerToken(request);

  if (token) {
    const tokenUserResult = await admin.auth.getUser(token);
    if (!tokenUserResult.error && tokenUserResult.data.user) {
      return tokenUserResult.data.user.id;
    }
  }

  const actorId = getActorIdHeader(request);
  if (actorId) {
    return actorId;
  }

  const routeClient = await createRouteSupabaseClient();
  const cookieUserResult = await routeClient.auth.getUser();
  if (!cookieUserResult.error && cookieUserResult.data.user) {
    return cookieUserResult.data.user.id;
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
