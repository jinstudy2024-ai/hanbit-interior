import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { UserRow, UserRole } from './supabase/types';

export async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<UserRow>();

  if (!profile) {
    return {
      supabase,
      profile: {
        id: user.id,
        email: user.email ?? '',
        name: null,
        role: '팀장' as UserRole,
        created_at: new Date().toISOString(),
      } satisfies UserRow,
    };
  }
  return { supabase, profile };
}

export async function requireRole(roles: UserRole[]) {
  const ctx = await requireUser();
  if (!roles.includes(ctx.profile.role)) {
    redirect('/my-receipts');
  }
  return ctx;
}
