'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/ConfidenceBadge';
import { teamDecide, bossDecide } from './actions';
import type { UserRole, ViolationStatus } from '@/lib/supabase/types';

export function ViolationActions({
  id,
  status,
  userRole,
}: {
  id: string;
  status: ViolationStatus;
  userRole: UserRole;
}) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  // 팀장: pending만 1단계 결재 가능
  const canTeamDecide = userRole === '팀장' && status === 'pending';
  // 사장: pending 또는 team_approved 결재 가능
  const canBossDecide = userRole === '사장' && (status === 'pending' || status === 'team_approved');

  async function handleTeam(decision: 'team_approved' | 'rejected') {
    setBusy(true);
    await teamDecide(id, decision, memo || undefined);
    setBusy(false);
    setMemoOpen(false);
    setMemo('');
  }

  async function handleBoss(decision: 'approved' | 'rejected') {
    setBusy(true);
    await bossDecide(id, decision, memo || undefined);
    setBusy(false);
    setMemoOpen(false);
    setMemo('');
  }

  if (!canTeamDecide && !canBossDecide) {
    return <StatusBadge status={status} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {canTeamDecide && (
          <>
            <button
              className="btn-primary py-1 text-xs"
              onClick={() => handleTeam('team_approved')}
              disabled={busy}
            >
              1차승인
            </button>
            <button
              className="btn-danger py-1 text-xs"
              onClick={() => handleTeam('rejected')}
              disabled={busy}
            >
              반려
            </button>
          </>
        )}
        {canBossDecide && (
          <>
            <button
              className="btn-primary py-1 text-xs"
              onClick={() => handleBoss('approved')}
              disabled={busy}
            >
              최종승인
            </button>
            <button
              className="btn-danger py-1 text-xs"
              onClick={() => handleBoss('rejected')}
              disabled={busy}
            >
              반려
            </button>
          </>
        )}
        <button
          className="btn-secondary py-1 text-xs"
          onClick={() => setMemoOpen(o => !o)}
          disabled={busy}
        >
          메모
        </button>
      </div>

      {memoOpen && (
        <input
          className="input text-xs"
          placeholder="결재 코멘트 (선택)"
          value={memo}
          onChange={e => setMemo(e.target.value)}
        />
      )}
    </div>
  );
}
