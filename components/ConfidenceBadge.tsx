import { confidenceLevel } from '@/lib/format';
import type { ViolationStatus } from '@/lib/supabase/types';

export function ConfidenceBadge({ value }: { value: number }) {
  const level = confidenceLevel(value);
  const color =
    level === 'high' ? 'bg-green-100 text-green-700'
    : level === 'mid' ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';
  const dot =
    level === 'high' ? 'bg-confidence-high'
    : level === 'mid' ? 'bg-confidence-mid'
    : 'bg-confidence-low';
  return (
    <span className={`badge ${color}`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${dot}`} />
      {(value * 100).toFixed(0)}%
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:       'bg-yellow-100 text-yellow-700',
    team_approved: 'bg-blue-100 text-blue-700',
    approved:      'bg-green-100 text-green-700',
    rejected:      'bg-red-100 text-red-700',
  };
  const label: Record<string, string> = {
    pending:       '대기',
    team_approved: '팀장승인',
    approved:      '최종승인',
    rejected:      '반려',
  };
  return (
    <span className={`badge ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label[status] ?? status}
    </span>
  );
}

export function SiteStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${
      status === '진행중' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {status}
    </span>
  );
}
