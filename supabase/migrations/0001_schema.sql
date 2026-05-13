-- ============================================================
-- 한빛인테리어 경비정산 자동화 시스템 - 스키마 초기화
-- Supabase 프로젝트: senior-practice2
-- 스키마: hanbit
-- ============================================================

-- 확장 활성화
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 스키마 생성
-- ============================================================
create schema if not exists hanbit;

-- PostgREST 접근 권한 (Supabase Dashboard > API > Extra Search Path에 hanbit 추가 필요)
grant usage on schema hanbit to anon, authenticated, service_role;
alter default privileges in schema hanbit
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema hanbit
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema hanbit
  grant all on routines  to anon, authenticated, service_role;

-- ============================================================
-- 1. users : 사용자 (auth.users 와 1:1)
-- ============================================================
create table if not exists hanbit.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  role        text not null check (role in ('사장','팀장','세무사')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_hanbit_users_role on hanbit.users(role);

-- ============================================================
-- 2. sites : 현장 (인테리어 공사 현장 관리)
-- ============================================================
create table if not exists hanbit.sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  status      text not null default '진행중' check (status in ('진행중','완료')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_hanbit_sites_status on hanbit.sites(status);

-- ============================================================
-- 3. receipts : 영수증 (OCR 결과 + 현장 연결, KRW 단일)
-- ============================================================
create table if not exists hanbit.receipts (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references hanbit.sites(id) on delete restrict,
  user_id         uuid not null references hanbit.users(id) on delete cascade,

  -- 영수증 본문
  date            date not null,
  merchant        text not null,
  biz_no          text,
  supply          numeric(14,2) not null default 0,
  vat             numeric(14,2) not null default 0,
  total           numeric(14,2) not null,

  -- 분류 / OCR
  category        text check (category in ('식대','접대','공구','소모품','기타')),
  is_simplified   boolean not null default false, -- 간이영수증 여부
  confidence      numeric(4,3) not null default 1.000,
  notes           text,
  image_url       text,

  -- 상태
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_hanbit_receipts_site_id    on hanbit.receipts(site_id);
create index if not exists idx_hanbit_receipts_user_id    on hanbit.receipts(user_id);
create index if not exists idx_hanbit_receipts_date       on hanbit.receipts(date desc);
create index if not exists idx_hanbit_receipts_status     on hanbit.receipts(status);
create index if not exists idx_hanbit_receipts_confidence on hanbit.receipts(confidence);
create index if not exists idx_hanbit_receipts_category   on hanbit.receipts(category);

-- ============================================================
-- 4. policies : 정책 (식대/접대/공구/금지업종)
-- ============================================================
create table if not exists hanbit.policies (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('식대','접대','공구','금지업종')),
  rule_type     text not null check (rule_type in ('limit','banned')),
  limit_amount  numeric(14,2),          -- 한도 (KRW). 금지업종이면 null
  banned_list   text[] default '{}',    -- 금지 키워드 목록
  active        boolean not null default true,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_hanbit_policies_category on hanbit.policies(category);
create index if not exists idx_hanbit_policies_active   on hanbit.policies(active);

-- ============================================================
-- 5. violations : 정책 위반 (2단계 결재: 팀장 → 사장)
-- ============================================================
create table if not exists hanbit.violations (
  id                uuid primary key default gen_random_uuid(),
  receipt_id        uuid not null references hanbit.receipts(id) on delete cascade,
  policy_id         uuid not null references hanbit.policies(id) on delete cascade,

  -- 2단계 결재 상태
  -- pending       : 팀장 결재 대기
  -- team_approved : 팀장 승인 완료, 사장 결재 대기
  -- approved      : 사장 최종 승인 (완료)
  -- rejected      : 반려 (어느 단계에서든)
  status            text not null default 'pending'
                    check (status in ('pending','team_approved','approved','rejected')),

  team_approver_id  uuid references hanbit.users(id), -- 1단계: 팀장
  boss_approver_id  uuid references hanbit.users(id), -- 2단계: 사장
  reason            text not null,
  team_memo         text,
  boss_memo         text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_hanbit_violations_receipt_id on hanbit.violations(receipt_id);
create index if not exists idx_hanbit_violations_policy_id  on hanbit.violations(policy_id);
create index if not exists idx_hanbit_violations_status     on hanbit.violations(status);
create unique index if not exists uq_hanbit_violations_receipt_policy
  on hanbit.violations(receipt_id, policy_id);

-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
create or replace function hanbit.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_hanbit_sites_updated_at on hanbit.sites;
create trigger trg_hanbit_sites_updated_at
  before update on hanbit.sites
  for each row execute function hanbit.set_updated_at();

drop trigger if exists trg_hanbit_receipts_updated_at on hanbit.receipts;
create trigger trg_hanbit_receipts_updated_at
  before update on hanbit.receipts
  for each row execute function hanbit.set_updated_at();

drop trigger if exists trg_hanbit_policies_updated_at on hanbit.policies;
create trigger trg_hanbit_policies_updated_at
  before update on hanbit.policies
  for each row execute function hanbit.set_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table hanbit.users      enable row level security;
alter table hanbit.sites      enable row level security;
alter table hanbit.receipts   enable row level security;
alter table hanbit.policies   enable row level security;
alter table hanbit.violations enable row level security;

-- 헬퍼: 현재 로그인 사용자의 hanbit 역할 반환
create or replace function hanbit.get_user_role()
returns text language sql stable security definer as $$
  select role from hanbit.users where id = auth.uid();
$$;

-- ── users ────────────────────────────────────────────────────
-- 본인 + 사장/팀장은 전체 조회
drop policy if exists hanbit_users_select on hanbit.users;
create policy hanbit_users_select on hanbit.users
  for select using (
    auth.uid() = id
    or hanbit.get_user_role() in ('사장','팀장')
  );

drop policy if exists hanbit_users_update on hanbit.users;
create policy hanbit_users_update on hanbit.users
  for update using (auth.uid() = id);

-- ── sites ────────────────────────────────────────────────────
-- 로그인 사용자 전체 조회 / 사장만 수정
drop policy if exists hanbit_sites_select on hanbit.sites;
create policy hanbit_sites_select on hanbit.sites
  for select using (auth.role() = 'authenticated');

drop policy if exists hanbit_sites_write on hanbit.sites;
create policy hanbit_sites_write on hanbit.sites
  for all using (hanbit.get_user_role() = '사장')
  with check (hanbit.get_user_role() = '사장');

-- ── receipts ─────────────────────────────────────────────────
-- 본인 영수증 CRUD / 사장·팀장 전체 조회+수정
drop policy if exists hanbit_receipts_all on hanbit.receipts;
create policy hanbit_receipts_all on hanbit.receipts
  for all using (
    auth.uid() = user_id
    or hanbit.get_user_role() in ('사장','팀장')
  ) with check (
    auth.uid() = user_id
    or hanbit.get_user_role() in ('사장','팀장')
  );

-- 세무사: 영수증 읽기 전용
drop policy if exists hanbit_receipts_tax_read on hanbit.receipts;
create policy hanbit_receipts_tax_read on hanbit.receipts
  for select using (hanbit.get_user_role() = '세무사');

-- ── policies ─────────────────────────────────────────────────
drop policy if exists hanbit_policies_select on hanbit.policies;
create policy hanbit_policies_select on hanbit.policies
  for select using (auth.role() = 'authenticated');

drop policy if exists hanbit_policies_write on hanbit.policies;
create policy hanbit_policies_write on hanbit.policies
  for all using (hanbit.get_user_role() = '사장')
  with check (hanbit.get_user_role() = '사장');

-- ── violations ───────────────────────────────────────────────
-- 본인 영수증 위반 + 사장·팀장 전체
drop policy if exists hanbit_violations_select on hanbit.violations;
create policy hanbit_violations_select on hanbit.violations
  for select using (
    hanbit.get_user_role() in ('사장','팀장')
    or exists (
      select 1 from hanbit.receipts r
      where r.id = violations.receipt_id and r.user_id = auth.uid()
    )
  );

-- 팀장: 1단계 결재 (pending → team_approved / rejected)
drop policy if exists hanbit_violations_team_write on hanbit.violations;
create policy hanbit_violations_team_write on hanbit.violations
  for update using (
    hanbit.get_user_role() = '팀장'
    and status = 'pending'
  );

-- 사장: 2단계 결재 (team_approved → approved / rejected) + 전체 INSERT/DELETE
drop policy if exists hanbit_violations_boss_write on hanbit.violations;
create policy hanbit_violations_boss_write on hanbit.violations
  for all using (hanbit.get_user_role() = '사장')
  with check (hanbit.get_user_role() = '사장');
