import { PageHeader } from '@/components/PageHeader';
import { requireRole } from '@/lib/auth';
import { formatMoney, monthRange, currentMonth } from '@/lib/format';
import type { ReceiptRow, SiteRow } from '@/lib/supabase/types';

export const revalidate = 0;

type ReceiptWithSite = ReceiptRow & { site: Pick<SiteRow, 'name'> | null };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { supabase } = await requireRole(['사장']);

  const now = currentMonth();
  const year  = Number(searchParams.y) || now.year;
  const month = Number(searchParams.m) || now.month;
  const range = monthRange(year, month);

  // 영수증
  const { data: rData } = await supabase
    .from('receipts')
    .select('*, site:site_id(name)')
    .gte('date', range.start)
    .lte('date', range.end);
  const receipts = (rData ?? []) as ReceiptWithSite[];

  // 위반
  const { data: vData } = await supabase
    .from('violations')
    .select('status, receipt:receipt_id(date)')
    .order('created_at', { ascending: false });
  type ViolJoined = { status: string; receipt: { date: string } | null };
  const violations = ((vData ?? []) as unknown as ViolJoined[]).filter(v => {
    const d = v.receipt?.date;
    return d && d >= range.start && d <= range.end;
  });

  const totalAmount = receipts.reduce((s, r) => s + r.total, 0);
  const approved    = receipts.filter(r => r.status === 'approved').length;
  const rejected    = receipts.filter(r => r.status === 'rejected').length;
  const pending     = receipts.filter(r => r.status === 'pending').length;
  const flagged     = receipts.filter(r => r.confidence < 0.85).length;
  const simplified  = receipts.filter(r => r.is_simplified).length;

  // 현장별 집계
  const bySite = new Map<string, { name: string; total: number; count: number }>();
  receipts.forEach(r => {
    const key = r.site?.name ?? '미지정';
    if (!bySite.has(key)) bySite.set(key, { name: key, total: 0, count: 0 });
    const b = bySite.get(key)!;
    b.total += r.total;
    b.count += 1;
  });

  // 카테고리별 집계
  const byCategory = new Map<string, number>();
  receipts.forEach(r => {
    const k = r.category ?? '미분류';
    byCategory.set(k, (byCategory.get(k) ?? 0) + r.total);
  });

  const years = [year - 1, year, year + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <>
      <PageHeader title="월간 KPI" subtitle={range.label}>
        <form method="get" className="flex gap-2">
          <select name="y" defaultValue={year} className="input">
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select name="m" defaultValue={month} className="input">
            {months.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <button className="btn-primary" type="submit">조회</button>
        </form>
      </PageHeader>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="총 지출"     value={formatMoney(totalAmount)} />
        <Kpi label="영수증 수"   value={`${receipts.length}건`} />
        <Kpi label="검수 대기"   value={`${pending}건`}
             sub={`승인 ${approved} · 반려 ${rejected}`} />
        <Kpi label="요주의"      value={`${flagged + simplified}건`}
             sub={`저신뢰도 ${flagged} · 간이영수증 ${simplified}`}
             tone={(flagged + simplified) > 0 ? 'low' : 'high'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 현장별 지출 */}
        <div className="card">
          <h3 className="mb-3 font-semibold">현장별 지출</h3>
          {bySite.size === 0
            ? <div className="text-center text-gray-400 text-sm">데이터 없음</div>
            : <BarList data={Array.from(bySite.values()).map(s => ({ label: s.name, value: s.total, sub: `${s.count}건` }))} />
          }
        </div>

        {/* 카테고리별 지출 */}
        <div className="card">
          <h3 className="mb-3 font-semibold">카테고리별 지출</h3>
          {byCategory.size === 0
            ? <div className="text-center text-gray-400 text-sm">데이터 없음</div>
            : <BarList data={Array.from(byCategory.entries()).map(([k, v]) => ({ label: k, value: v }))} />
          }
        </div>
      </div>

      {/* 위반 현황 */}
      <div className="mt-6 card">
        <h3 className="mb-3 font-semibold">위반 현황 ({violations.length}건)</h3>
        <div className="grid grid-cols-4 gap-3">
          <Kpi tone="low"  label="1차 대기"  value={`${violations.filter(v => v.status === 'pending').length}건`} />
          <Kpi tone="mid"  label="2차 대기"  value={`${violations.filter(v => v.status === 'team_approved').length}건`} />
          <Kpi tone="high" label="최종승인"  value={`${violations.filter(v => v.status === 'approved').length}건`} />
          <Kpi           label="반려"        value={`${violations.filter(v => v.status === 'rejected').length}건`} />
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'low'|'mid'|'high' }) {
  const ring  = tone === 'low' ? 'ring-confidence-low/30' : tone === 'high' ? 'ring-confidence-high/30' : tone === 'mid' ? 'ring-yellow-300' : 'ring-gray-200';
  const color = tone === 'low' ? 'text-confidence-low'    : tone === 'high' ? 'text-confidence-high'    : tone === 'mid' ? 'text-yellow-700'  : 'text-gray-900';
  return (
    <div className={`card ring-1 ${ring}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function BarList({ data }: { data: { label: string; value: number; sub?: string }[] }) {
  if (data.length === 0) return <div className="text-center text-gray-400">데이터 없음</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.sort((a, b) => b.value - a.value).map(d => (
        <li key={d.label}>
          <div className="flex justify-between text-xs">
            <span>{d.label}{d.sub ? <span className="ml-1 text-gray-400">{d.sub}</span> : ''}</span>
            <span className="tabular-nums text-gray-600">{formatMoney(d.value)}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded bg-gray-100">
            <div className="h-full bg-brand" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
