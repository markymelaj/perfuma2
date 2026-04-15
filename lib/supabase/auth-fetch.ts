'use client';

import { createClient } from '@/lib/supabase/client';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();

  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (data.session?.access_token) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }
  if (data.session?.user?.id) {
    headers.set('x-user-id', data.session.user.id);
  }

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
}

export async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return {} as Record<string, unknown>;
  }
}
