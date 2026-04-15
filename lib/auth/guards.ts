import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, Profile } from '@/lib/types';

export const isAdminRole = (role: AppRole) => role === 'super_admin' || role === 'owner';

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/login?error=inactive');
  return profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (!isAdminRole(profile.role)) {
    redirect('/seller');
  }
  return profile;
}

export async function requireSeller() {
  const profile = await requireProfile();
  if (isAdminRole(profile.role)) {
    redirect('/owner');
  }
  return profile;
}
