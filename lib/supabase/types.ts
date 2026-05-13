// 한빛인테리어 Supabase 타입 정의 (hanbit 스키마)

export type UserRole    = '사장' | '팀장' | '세무사';
export type Category    = '식대' | '접대' | '공구' | '소모품' | '기타';
export type ReceiptStatus   = 'pending' | 'approved' | 'rejected';
export type ViolationStatus = 'pending' | 'team_approved' | 'approved' | 'rejected';
export type SiteStatus      = '진행중' | '완료';
export type PolicyCategory  = '식대' | '접대' | '공구' | '금지업종';
export type PolicyRuleType  = 'limit' | 'banned';

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
}

export interface SiteRow {
  id: string;
  name: string;
  address: string | null;
  status: SiteStatus;
  created_at: string;
  updated_at: string;
}

export interface ReceiptRow {
  id: string;
  site_id: string;
  user_id: string;
  date: string;
  merchant: string;
  biz_no: string | null;
  supply: number;
  vat: number;
  total: number;
  category: Category | null;
  is_simplified: boolean;
  confidence: number;
  notes: string | null;
  image_url: string | null;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
}

export interface PolicyRow {
  id: string;
  category: PolicyCategory;
  rule_type: PolicyRuleType;
  limit_amount: number | null;
  banned_list: string[];
  active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViolationRow {
  id: string;
  receipt_id: string;
  policy_id: string;
  status: ViolationStatus;
  team_approver_id: string | null;
  boss_approver_id: string | null;
  reason: string;
  team_memo: string | null;
  boss_memo: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface SiteCostSummaryRow {
  site_id: string;
  site_name: string;
  site_status: SiteStatus;
  receipt_count: number;
  total_amount: number;
  violation_count: number;
  pending_count: number;
}
