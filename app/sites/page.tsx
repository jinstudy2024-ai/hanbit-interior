import { PageHeader } from '@/components/PageHeader';
import { requireRole } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { SiteStatusBadge } from '@/components/ConfidenceBadge';
import type { SiteCostSummaryRow } from '@/lib/supabase/types';

export const revalidate = 0;

export default async function SitesPage() {
  const { supabase } = await requireRole(['사장']);

  const { data } = await supabase.rpc('site_cost_summary');
  const rows = (data ?? []) as SiteCostSummaryRow[];

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalReceipts = rows.reduce((s, r) => s + Number(r.receipt_count), 0);

  return (
    <>
      <PageHeader
        title="현장별 원가 현황"
        subtitle={`전체 ${rows.length}개 현장 · ${formatMoney(totalAmount)} · ${totalReceipts}건`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(row => (
          <div key={row.site_id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-gray-900">{row.site_name}</div>
              </div>
              <SiteStatusBadge status={row.site_status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-brand-50 p-3">
                <div className="text-xs text-gray-500">총 지출</div>
                <div className="mt-1 text-lg font-bold text-brand">
                  {formatMoney(Number(row.total_amount))}
                </div>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <div className="text-xs text-gray-500">영수증</div>
                <div className="mt-1 text-lg font-bold text-gray-900">
                  {row.receipt_count}건
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
              <span className="text-gray-500">정책 위반</span>
              <span className={`font-semibold ${Number(row.violation_count) > 0 ? 'text-confidence-low' : 'text-confidence-high'}`}>
                {row.violation_count}건
                {Number(row.pending_count) > 0 && (
                  <span className="ml-1 text-xs text-yellow-600">
                    (결재대기 {row.pending_count})
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="card text-center text-gray-500">현장 데이터가 없습니다.</div>
      )}

      {/* 현장 합계 테이블 */}
      {rows.length > 0 && (
        <div className="mt-6 card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>현장명</th>
                <th>상태</th>
                <th className="text-right">영수증</th>
                <th className="text-right">지출 합계</th>
                <th className="text-right">위반</th>
                <th className="text-right">결재대기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.site_id}>
                  <td className="font-medium">{row.site_name}</td>
                  <td><SiteStatusBadge status={row.site_status} /></td>
                  <td className="text-right tabular-nums">{row.receipt_count}건</td>
                  <td className="text-right tabular-nums font-semibold">
                    {formatMoney(Number(row.total_amount))}
                  </td>
                  <td className={`text-right tabular-nums ${Number(row.violation_count) > 0 ? 'text-confidence-low font-semibold' : ''}`}>
                    {row.violation_count}건
                  </td>
                  <td className={`text-right tabular-nums ${Number(row.pending_count) > 0 ? 'text-yellow-600 font-semibold' : ''}`}>
                    {row.pending_count}건
                  </td>
                </tr>
              ))}
              <tr className="bg-brand-50 font-bold">
                <td colSpan={2}>합계</td>
                <td className="text-right tabular-nums">{totalReceipts}건</td>
                <td className="text-right tabular-nums text-brand">{formatMoney(totalAmount)}</td>
                <td className="text-right tabular-nums text-confidence-low">
                  {rows.reduce((s, r) => s + Number(r.violation_count), 0)}건
                </td>
                <td className="text-right tabular-nums text-yellow-600">
                  {rows.reduce((s, r) => s + Number(r.pending_count), 0)}건
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
