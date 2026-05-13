// 한빛인테리어 포맷 유틸리티 (KRW 단일, 월별 집계)

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export type ConfidenceLevel = 'high' | 'mid' | 'low';

export function confidenceLevel(c: number): ConfidenceLevel {
  if (c >= 0.95) return 'high';
  if (c >= 0.65) return 'mid';
  return 'low';
}

// 월 범위 계산
export function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end:   `${year}-${pad(month)}-${pad(daysInMonth)}`,
    label: `${year}년 ${month}월`,
  };
}

export function currentMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
