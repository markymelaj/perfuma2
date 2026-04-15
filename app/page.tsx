import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/guards';
import { isAdminRole } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/login?error=inactive');
  if (isAdminRole(profile.role)) redirect('/owner');
  redirect('/seller');
}
