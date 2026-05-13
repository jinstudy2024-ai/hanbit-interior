'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { formatMoney } from '@/lib/format';
import type { Category, SiteRow } from '@/lib/supabase/types';

const MAX_FILES = 30;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'hanbit-receipts';

type OcrResult = {
  file_name: string;
  index: number;
  date: string;
  merchant: string;
  biz_no: string | null;
  supply: number;
  vat: number;
  total: number;
  category: Category;
  is_simplified: boolean;
  confidence: number;
};

type Step = 'idle' | 'uploading' | 'ocr' | 'saving' | 'done' | 'error';

export function UploadDropzone({
  sites,
}: {
  sites: Pick<SiteRow, 'id' | 'name' | 'status'>[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>('idle');
  const [results, setResults] = useState<(OcrResult & { violations?: number })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const onPickFiles = useCallback((picked: FileList | File[]) => {
    const arr = Array.from(picked).slice(0, MAX_FILES);
    setFiles(arr);
    setError(null);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    onPickFiles(e.dataTransfer.files);
  }

  async function onProcess() {
    if (!siteId) { setError('현장을 선택하세요.'); return; }
    if (files.length === 0) { setError('영수증을 1장 이상 선택하세요.'); return; }
    setError(null);
    setStep('uploading');
    setResults([]);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('로그인이 필요합니다.'); setStep('error'); return; }

    // 1) Storage 업로드
    const imageUrls: (string | null)[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`이미지 업로드 ${i + 1}/${files.length}`);
      const path = `${user.id}/${Date.now()}-${i}-${f.name.replace(/[^\w.\-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
        cacheControl: '3600', upsert: false,
      });
      if (upErr) {
        imageUrls.push(null);
      } else {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        imageUrls.push(pub.publicUrl);
      }
    }

    // 2) OCR
    setStep('ocr');
    setProgress(`OCR 분석 중 (${files.length}장)`);
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const ocrRes = await fetch('/api/ocr', { method: 'POST', body: form });
    if (!ocrRes.ok) { setError('OCR 호출 실패'); setStep('error'); return; }
    const { results: ocrResults } = (await ocrRes.json()) as { results: OcrResult[] };

    // 3) DB INSERT + RPC 검증
    setStep('saving');
    const finalResults: (OcrResult & { violations?: number })[] = [];

    for (let i = 0; i < ocrResults.length; i++) {
      const r = ocrResults[i];
      setProgress(`저장 ${i + 1}/${ocrResults.length}`);

      const { data: ins, error: insErr } = await supabase
        .from('receipts')
        .insert({
          site_id: siteId,
          user_id: user.id,
          date: r.date,
          merchant: r.merchant,
          biz_no: r.biz_no,
          supply: r.supply,
          vat: r.vat,
          total: r.total,
          category: r.category,
          is_simplified: r.is_simplified,
          confidence: r.confidence,
          image_url: imageUrls[i],
        })
        .select('id')
        .single();

      if (insErr || !ins) {
        finalResults.push({ ...r, violations: -1 });
        continue;
      }

      const { data: check } = await supabase.rpc('check_policy_compliance', {
        p_receipt_id: ins.id,
      });
      const violations = (check as { violation_count?: number } | null)?.violation_count ?? 0;
      finalResults.push({ ...r, violations });
    }

    setResults(finalResults);
    setStep('done');
    setProgress('');
    router.refresh();
  }

  function reset() {
    setFiles([]); setResults([]); setStep('idle'); setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const busy = step !== 'idle' && step !== 'done' && step !== 'error';

  return (
    <div className="space-y-5">
      {/* 현장 선택 */}
      <div className="card">
        <label className="label" htmlFor="site-select">현장 선택</label>
        <select
          id="site-select"
          className="input max-w-xs"
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
          disabled={busy}
        >
          <option value="">-- 현장 선택 --</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} {s.status === '완료' ? '(완료)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 드래그앤드롭 */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className="card flex min-h-[200px] flex-col items-center justify-center border-2 border-dashed border-brand-200 bg-brand-50/40 text-center"
      >
        <div className="text-4xl">📥</div>
        <div className="mt-3 text-lg font-semibold text-gray-800">
          영수증을 여기로 드래그하거나
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-primary mt-3"
          disabled={busy}
        >
          파일 선택 (최대 {MAX_FILES}장)
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={e => e.target.files && onPickFiles(e.target.files)}
        />
        <div className="mt-2 text-xs text-gray-500">JPG · PNG · PDF 지원</div>
      </div>

      {files.length > 0 && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">선택된 파일 ({files.length}장)</div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={reset} disabled={busy}>초기화</button>
              <button className="btn-primary" onClick={onProcess} disabled={busy}>
                {busy ? '처리 중...' : 'OCR + 정책 검증'}
              </button>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {files.map((f, i) => (
              <li key={i} className="rounded border border-gray-200 px-3 py-2 text-xs text-gray-700">
                <div className="truncate">{f.name}</div>
                <div className="text-gray-400">{(f.size / 1024).toFixed(1)} KB</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {busy && (
        <div className="card flex items-center gap-3">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand" />
          <span className="text-sm text-gray-700">{progress || '처리 중...'}</span>
        </div>
      )}

      {error && (
        <div className="card border-confidence-low/30 bg-red-50 text-confidence-low">{error}</div>
      )}

      {results.length > 0 && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">처리 결과 ({results.length}장)</div>
              <div className="text-xs text-gray-500">
                위반 {results.reduce((a, r) => a + Math.max(0, r.violations ?? 0), 0)}건 ·
                저신뢰도 {results.filter(r => r.confidence < 0.85).length}건 ·
                간이영수증 {results.filter(r => r.is_simplified).length}건
              </div>
            </div>
            <a className="btn-secondary" href="/my-receipts">내 영수증 보기 →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>날짜</th><th>가맹점</th><th>분류</th>
                  <th className="text-right">금액</th>
                  <th>신뢰도</th><th>간이</th><th>위반</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td className="font-medium">{r.merchant}</td>
                    <td>{r.category}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.total)}</td>
                    <td><ConfidenceBadge value={r.confidence} /></td>
                    <td>{r.is_simplified ? <span className="text-yellow-600 text-xs">간이</span> : '-'}</td>
                    <td>
                      {r.violations === -1
                        ? <span className="text-confidence-low">저장실패</span>
                        : r.violations === 0
                          ? <span className="text-confidence-high">없음</span>
                          : <span className="text-confidence-low font-semibold">{r.violations}건</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
