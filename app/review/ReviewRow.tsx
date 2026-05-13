'use client';

import { useState } from 'react';
import { ConfidenceBadge, StatusBadge } from '@/components/ConfidenceBadge';
import { formatDate, formatMoney } from '@/lib/format';
import { decideReceipt, recheckReceipt } from './actions';
import type { ReceiptRow, SiteRow, UserRow, ViolationRow, PolicyRow } from '@/lib/supabase/types';

type Row = ReceiptRow & {
  site: Pick<SiteRow, 'name'> | null;
  user: Pick<UserRow, 'name' | 'email'> | null;
  violations: (ViolationRow & { policy: Pick<PolicyRow, 'rule_type' | 'category'> | null })[];
};

export function ReviewRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    await decideReceipt(row.id, decision);
    setBusy(false);
  }

  async function recheck() {
    setBusy(true);
    await recheckReceipt(row.id);
    setBusy(false);
  }

  return (
    <>
      <tr
        className="cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td>{formatDate(row.date)}</td>
        <td className="text-xs text-gray-500">{row.site?.name ?? '-'}</td>
        <td>{row.user?.name ?? row.user?.email ?? '-'}</td>
        <td className="font-medium">{row.merchant}</td>
        <td>{row.category ?? '-'}</td>
        <td className="text-right tabular-nums">{formatMoney(row.total)}</td>
        <td>{row.is_simplified && <span className="badge bg-yellow-100 text-yellow-700">간이</span>}</td>
        <td><ConfidenceBadge value={row.confidence} /></td>
        <td>
          {row.violations.length > 0 && (
            <span className="badge bg-red-100 text-red-700">{row.violations.length}건</span>
          )}
        </td>
        <td><StatusBadge status={row.status} /></td>
        <td className="text-xs text-gray-500">{open ? '▲' : '▼'}</td>
      </tr>

      {open && (
        <tr>
          <td colSpan={11} className="bg-gray-50 px-4 py-4">
            <div className="space-y-3">
              {/* 상세 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-gray-500">사업자번호</div>
                  <div>{row.biz_no ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">공급가 / VAT</div>
                  <div>{formatMoney(row.supply)} / {formatMoney(row.vat)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">메모</div>
                  <div className="text-xs">{row.notes ?? '-'}</div>
                </div>
              </div>

              {/* 위반 목록 */}
              {row.violations.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-confidence-low">정책 위반</div>
                  <ul className="space-y-1">
                    {row.violations.map(v => (
                      <li key={v.id} className="text-xs text-gray-700 bg-red-50 rounded px-2 py-1">
                        <span className="badge bg-red-100 text-red-600 mr-1">{v.policy?.rule_type}</span>
                        {v.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 결재 버튼 */}
              {row.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button
                    className="btn-primary"
                    onClick={() => decide('approved')}
                    disabled={busy}
                  >
                    승인
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => decide('rejected')}
                    disabled={busy}
                  >
                    반려
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={recheck}
                    disabled={busy}
                  >
                    재검증
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
