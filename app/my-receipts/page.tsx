import { PageHeader } from '@/components/PageHeader';
import { requireUser } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { ConfidenceBadge, StatusBadge } from '@/components/ConfidenceBadge';
import type { ReceiptRow, SiteRow, UserRow } from '@/lib/supabase/types';

export const revalidate = 0;

type Row = ReceiptRow & {
  site: Pick<SiteRow, 'name'> | null;
};

export default async function MyReceiptsPage({
  searchParams,
}: {
  searchParams: { site?: string };
}) {
  const { supabase, profile } = await requireUser();

  // 현장 목록 (필터용)
  const { data: sitesData } = await supabase
    .from('sites').select('id, name').order('name');
  const sites = (sitesData ?? []) as Pick<SiteRow, 'id' | 'name'>[];

  // 영수증 조회
  let q = supabase
    .from('receipts')
    .select('*, site:site_id(name)')
    .order('date', { ascending: false })
    .limit(200);

  // 사장/팀장은 전체, 나머지는 본인만
  if (profile.role === '세무사') {
    q = q.eq('user_id', profile.id);
  }
  if (searchParams.site) {
    q = q.eq('site_id', searchParams.site);
  }

  const { data } = await q;
  const receipts = (data ?? []) as Row[];
  const total = receipts.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <PageHeader
        title="내 영수증"
        subtitle={`${receipts.length}건 · ${formatMoney(total)}`}
      >
        <a href="/upload" className="btn-primary">+ 영수증 업로드</a>
      </PageHeader>

      {/* 현장 필터 */}
      <nav className="mb-4 flex flex-wrap gap-2">
        <a
          href="/my-receipts"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            !searchParams.site ? 'bg-brand text-white' : 'bg-white text-gray-700 hover:bg-brand-50'
          }`}
        >
          전체
        </a>
        {sites.map(s => (
          <a
            key={s.id}
            href={`/my-receipts?site=${s.id}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              searchParams.site === s.id ? 'bg-brand text-white' : 'bg-white text-gray-700 hover:bg-brand-50'
            }`}
          >
            {s.name}
          </a>
        ))}
      </nav>

      {receipts.length === 0 ? (
        <div className="card text-center text-gray-500">
          영수증이 없습니다.{' '}
          <a href="/upload" className="text-brand underline">지금 업로드하기</a>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>날짜</th>
                <th>현장</th>
                <th>가맹점</th>
                <th>분류</th>
                <th className="text-right">금액</th>
                <th>간이</th>
                <th>신뢰도</th>
                <th>상태</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map(r => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td className="text-xs text-gray-500">{r.site?.name ?? '-'}</td>
                  <td className="font-medium">{r.merchant}</td>
                  <td>{r.category ?? '-'}</td>
                  <td className="text-right tabular-nums">{formatMoney(r.total)}</td>
                  <td>
                    {r.is_simplified && (
                      <span className="badge bg-yellow-100 text-yellow-700">간이</span>
                    )}
                  </td>
                  <td><ConfidenceBadge value={r.confidence} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="max-w-[200px] truncate text-xs text-gray-500">{r.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
