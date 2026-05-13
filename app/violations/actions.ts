'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';

// 팀장 1단계: pending → team_approved / rejected
export async function teamDecide(
  violationId: string,
  decision: 'team_approved' | 'rejected',
  memo?: string,
) {
  const { supabase, profile } = await requireRole(['팀장', '사장']);
  const { error } = await supabase
    .from('violations')
    .update({
      status: decision,
      team_approver_id: profile.id,
      team_memo: memo ?? null,
      ...(decision === 'rejected' ? { resolved_at: new Date().toISOString() } : {}),
    })
    .eq('id', violationId)
    .eq('status', 'pending');
  if (error) throw error;
  revalidatePath('/violations');
  revalidatePath('/dashboard');
}

// 사장 2단계: team_approved → approved / rejected (pending도 바로 처리 가능)
export async function bossDecide(
  violationId: string,
  decision: 'approved' | 'rejected',
  memo?: string,
) {
  const { supabase, profile } = await requireRole(['사장']);
  const { error } = await supabase
    .from('violations')
    .update({
      status: decision,
      boss_approver_id: profile.id,
      boss_memo: memo ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', violationId);
  if (error) throw error;
  revalidatePath('/violations');
  revalidatePath('/dashboard');
}
