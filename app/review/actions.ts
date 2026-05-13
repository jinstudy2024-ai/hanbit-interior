'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';

export async function decideReceipt(
  receiptId: string,
  decision: 'approved' | 'rejected',
) {
  const { supabase } = await requireRole(['사장', '팀장']);
  const { error } = await supabase
    .from('receipts')
    .update({ status: decision })
    .eq('id', receiptId);
  if (error) throw error;
  revalidatePath('/review');
  revalidatePath('/my-receipts');
}

export async function recheckReceipt(receiptId: string) {
  const { supabase } = await requireRole(['사장', '팀장']);
  const { error } = await supabase.rpc('check_policy_compliance', {
    p_receipt_id: receiptId,
  });
  if (error) throw error;
  revalidatePath('/review');
  revalidatePath('/violations');
}
