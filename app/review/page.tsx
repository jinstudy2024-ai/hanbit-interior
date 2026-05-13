import { PageHeader } from '@/components/PageHeader';
import { requireRole } from '@/lib/auth';
import type { ReceiptRow, SiteRow, UserRow, ViolationRow, PolicyRow } from '@/lib/supabase/types';
import { ReviewRow } from './ReviewRow';

export const revalidate = 0;

type Row = ReceiptRow & {
  site: Pick<SiteRow, 'name'> | null;
  user: Pick<UserRow, 'name' | 'email'> | null;
  violations: (ViolationRow & { policy: Pick<PolicyRow, 'rule_type' | 'category'> | null })[];
};

export default async function ReviewPage() {
  const { supabase } = await requireRole(['사장', '팀장']);

  const { data } = await supabase
    .from('receipts')
    .select(`
      *,
      site:site_id(name),
      user:user_id(name, email),
      violations(
        id, status, reason,
        policy:policy_id(rule_type, category)
      )
    `)
    .eq('status', 'pending')
    .order('confidence', { ascending: true })
    .limit(200);

  const rows = (data ?? []) as Row[];

  const withViolation = rows.filter(r => r.violations.length > 0);
  const simplified    = rows.filter(r => r.is_simplified);
  const lowConf       = rows.filter(r => r.confidence < 0.85);

  return (
    <>
      <PageHeader
        title="검수 대기"
        subtitle={`대기 ${rows.length}건 · 위반 ${withViolation.length}건 · 간이 ${simplified.length}건 · 저신뢰도 ${lowConf.length}건`}
      />

      {rows.length === 0 ? (
        <div className="card text-center text-gray-500">검수 대기 영수증이 없습니다.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>날짜</th>
                <th>현장</th>
                <th>제출자</th>
                <th>가맹점</th>
                <th>분류</th>
                <th className="text-right">금액</th>
                <th>간이</th>
                <th>신뢰도</th>
                <th>위반</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <ReviewRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
