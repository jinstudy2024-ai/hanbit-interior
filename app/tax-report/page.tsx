import { PageHeader } from '@/components/PageHeader';
import { requireRole } from '@/lib/auth';
import { formatMoney, monthRange, currentMonth } from '@/lib/format';
import type { ReceiptRow, SiteRow } from '@/lib/supabase/types';
import { CsvDownload } from './CsvDownload';

export const revalidate = 0;

type Row = ReceiptRow & { site: Pick<SiteRow, 'name'> | null };

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { supabase } = await requireRole(['사장', '세무사']);

  const now   = currentMonth();
  const year  = Number(searchParams.y) || now.year;
  const month = Number(searchParams.m) || now.month;
  const range = monthRange(year, month);

  const { data } = await supabase
    .from('receipts')
    .select('*, site:site_id(name)')
    .gte('date', range.start)
    .lte('date', range.end)
    .order('date');
  const receipts = (data ?? []) as Row[];

  // ── CSV 패키지 ①: 경비지출 내역 (전체) ──────────────────────
  const csv1: (string | number | boolean | null)[][] = [
    ['No', '날짜', '현장', '가맹점', '사업자번호', '분류', '공급가', '부가세', '합계', '간이영수증', '상태', '메모'],
    ...receipts.map((r, i) => [
      i + 1,
      r.date,
      r.site?.name ?? '',
      r.merchant,
      r.biz_no ?? '',
      r.category ?? '',
      r.supply,
      r.vat,
      r.total,
      r.is_simplified ? 'O' : '',
      r.status,
      r.notes ?? '',
    ]),
  ];

  // ── CSV 패키지 ②: 세금계산서 적격 내역 (biz_no 있음 + 간이 아님) ──
  const taxReceipts = receipts.filter(r => r.biz_no && !r.is_simplified);
  const csv2: (string | number | null)[][] = [
    ['No', '날짜', '현장', '가맹점', '사업자번호', '공급가', '부가세', '합계'],
    ...taxReceipts.map((r, i) => [
      i + 1, r.date, r.site?.name ?? '', r.merchant,
      r.biz_no ?? '', r.supply, r.vat, r.total,
    ]),
  ];

  // ── CSV 패키지 ③: 간이영수증 내역 ───────────────────────────
  const simpReceipts = receipts.filter(r => r.is_simplified);
  const csv3: (string | number | null)[][] = [
    ['No', '날짜', '현장', '가맹점', '분류', '합계', '메모'],
    ...simpReceipts.map((r, i) => [
      i + 1, r.date, r.site?.name ?? '', r.merchant,
      r.category ?? '', r.total, r.notes ?? '',
    ]),
  ];

  const totalAmount     = receipts.reduce((s, r) => s + r.total, 0);
  const taxTotal        = taxReceipts.reduce((s, r) => s + r.total, 0);
  const simpTotal       = simpReceipts.reduce((s, r) => s + r.total, 0);
  const years = [year - 1, year, year + 1];

  return (
    <>
      <PageHeader title="세무사 패키지" subtitle={`${range.label} CSV 3종 다운로드`}>
        <form method="get" className="flex gap-2">
          <select name="y" defaultValue={year} className="input">
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select name="m" defaultValue={month} className="input">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <button className="btn-primary" type="submit">조회</button>
        </form>
      </PageHeader>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-xs text-gray-500">총 경비</div>
          <div className="mt-1 text-xl font-bold text-gray-900">{formatMoney(totalAmount)}</div>
          <div className="text-xs text-gray-400">{receipts.length}건</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-gray-500">세금계산서 적격</div>
          <div className="mt-1 text-xl font-bold text-confidence-high">{formatMoney(taxTotal)}</div>
          <div className="text-xs text-gray-400">{taxReceipts.length}건</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-gray-500">간이영수증</div>
          <div className="mt-1 text-xl font-bold text-yellow-600">{formatMoney(simpTotal)}</div>
          <div className="text-xs text-gray-400">{simpReceipts.length}건</div>
        </div>
      </div>

      {/* CSV 다운로드 3종 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="card space-y-3">
          <div>
            <div className="font-semibold">① 경비지출 내역</div>
            <div className="text-xs text-gray-500 mt-1">
              전체 영수증 · 현장/가맹점/분류/금액
            </div>
          </div>
          <CsvDownload
            rows={csv1}
            filename={`한빛_경비지출_${year}${String(month).padStart(2,'0')}.csv`}
            label="경비지출 CSV"
          />
        </div>

        <div className="card space-y-3">
          <div>
            <div className="font-semibold">② 세금계산서 적격 내역</div>
            <div className="text-xs text-gray-500 mt-1">
              사업자번호 확인 + 일반영수증만
            </div>
          </div>
          <CsvDownload
            rows={csv2}
            filename={`한빛_세금계산서_${year}${String(month).padStart(2,'0')}.csv`}
            label="세금계산서 CSV"
          />
        </div>

        <div className="card space-y-3">
          <div>
            <div className="font-semibold">③ 간이영수증 내역</div>
            <div className="text-xs text-gray-500 mt-1">
              사업자미확인 간이영수증 목록
            </div>
          </div>
          <CsvDownload
            rows={csv3}
            filename={`한빛_간이영수증_${year}${String(month).padStart(2,'0')}.csv`}
            label="간이영수증 CSV"
          />
        </div>
      </div>

      {/* 명세 테이블 */}
      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>No</th><th>날짜</th><th>현장</th><th>가맹점</th>
              <th>분류</th>
              <th className="text-right">공급가</th>
              <th className="text-right">부가세</th>
              <th className="text-right">합계</th>
              <th>간이</th><th>상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {receipts.length === 0 ? (
              <tr><td colSpan={10} className="py-6 text-center text-gray-400">데이터 없음</td></tr>
            ) : receipts.map((r, i) => (
              <tr key={r.id}>
                <td className="text-gray-400">{i + 1}</td>
                <td>{r.date}</td>
                <td className="text-xs text-gray-500">{r.site?.name ?? '-'}</td>
                <td className="font-medium">{r.merchant}</td>
                <td>{r.category ?? '-'}</td>
                <td className="text-right tabular-nums">{formatMoney(r.supply)}</td>
                <td className="text-right tabular-nums">{formatMoney(r.vat)}</td>
                <td className="text-right tabular-nums font-semibold">{formatMoney(r.total)}</td>
                <td>
                  {r.is_simplified && (
                    <span className="badge bg-yellow-100 text-yellow-700">간이</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${
                    r.status === 'approved' ? 'bg-green-100 text-green-700'
                    : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {r.status === 'approved' ? '승인' : r.status === 'rejected' ? '반려' : '대기'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {receipts.length > 0 && (
            <tfoot>
              <tr className="bg-brand-50 font-bold">
                <td colSpan={5}>합계</td>
                <td className="text-right tabular-nums">{formatMoney(receipts.reduce((s,r)=>s+r.supply,0))}</td>
                <td className="text-right tabular-nums">{formatMoney(receipts.reduce((s,r)=>s+r.vat,0))}</td>
                <td className="text-right tabular-nums text-brand">{formatMoney(totalAmount)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
