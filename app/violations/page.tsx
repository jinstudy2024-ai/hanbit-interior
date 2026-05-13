import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/ConfidenceBadge';
import { requireRole } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import type { ReceiptRow, SiteRow, ViolationRow, PolicyRow, UserRole } from '@/lib/supabase/types';
import { ViolationActions } from './ViolationActions';

export const revalidate = 0;

type Row = ViolationRow & {
  receipt: Pick<ReceiptRow, 'id' | 'date' | 'merchant' | 'total' | 'category'> & {
    site: Pick<SiteRow, 'name'> | null;
    user: { name: string | null; email: string } | null;
  };
  policy: Pick<PolicyRow, 'rule_type' | 'category'>;
};

const STATUS_TABS = [
  { k: 'pending',       label: '⏳ 1차 대기' },
  { k: 'team_approved', label: '✅ 2차 대기' },
  { k: 'approved',      label: '🏆 최종승인' },
  { k: 'rejected',      label: '⛔ 반려' },
  { k: 'all',           label: '전체' },
];

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { supabase, profile } = await requireRole(['사장', '팀장']);
  const status = searchParams.status ?? 'pending';

  let q = supabase
    .from('violations')
    .select(`
      *,
      receipt:receipt_id (
        id, date, merchant, total, category,
        site:site_id(name),
        user:user_id(name, email)
      ),
      policy:policy_id(rule_type, category)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') q = q.eq('status', status);

  const { data } = await q;
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="위반 결재"
        subtitle={`${rows.length}건 · ${profile.role === '팀장' ? '1차 결재 담당' : '최종 결재 담당'}`}
      />

      {/* 단계 안내 */}
      <div className="mb-4 flex gap-2 rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
        <span className="font-semibold">결재 흐름:</span>
        <span>대기 → 팀장 1차 승인 → 사장 최종 승인</span>
      </div>

      {/* 탭 */}
      <nav className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map(t => (
          <a
            key={t.k}
            href={`/violations?status=${t.k}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === t.k ? 'bg-brand text-white' : 'bg-white text-gray-700 hover:bg-brand-50'
            }`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card text-center text-gray-500">해당 상태의 위반이 없습니다.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>날짜</th>
                <th>현장</th>
                <th>제출자</th>
                <th>가맹점</th>
                <th>규칙</th>
                <th>사유</th>
                <th className="text-right">금액</th>
                <th>상태</th>
                <th className="w-44">결재</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{formatDate(r.receipt.date)}</td>
                  <td className="text-xs text-gray-500">{r.receipt.site?.name ?? '-'}</td>
                  <td>{r.receipt.user?.name ?? r.receipt.user?.email ?? '-'}</td>
                  <td className="font-medium">{r.receipt.merchant}</td>
                  <td>
                    <span className="badge bg-brand-50 text-brand">{r.policy.rule_type}</span>
                  </td>
                  <td className="max-w-[280px] text-xs text-gray-700">{r.reason}</td>
                  <td className="text-right tabular-nums">{formatMoney(r.receipt.total)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <ViolationActions
                      id={r.id}
                      status={r.status}
                      userRole={profile.role as UserRole}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
