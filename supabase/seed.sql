-- ============================================================
-- 한빛인테리어 경비정산 - 시드 데이터
-- 실행 순서: 0001_schema.sql → 0002_rpc.sql → seed.sql
--
-- 로그인 계정 (비밀번호 공통: hanbit2026)
--   사장  : boss@hanbit.co.kr
--   팀장  : team@hanbit.co.kr
--   세무사: tax@hanbit.co.kr
-- ============================================================

-- 외래키 의존성 우회 (시드 목적 only)
set session_replication_role = replica;

-- ============================================================
-- 1. auth.users — 로그인 가능한 계정 생성
-- ============================================================
insert into auth.users (
  id, aud, role, email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at, updated_at
) values
  -- 사장
  ('b0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated',
   'boss@hanbit.co.kr',
   crypt('hanbit2026', gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"박사장","role":"사장"}',
   now(), now()),
  -- 팀장
  ('b0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated',
   'team@hanbit.co.kr',
   crypt('hanbit2026', gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"김팀장","role":"팀장"}',
   now(), now()),
  -- 세무사
  ('b0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated',
   'tax@hanbit.co.kr',
   crypt('hanbit2026', gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"이세무사","role":"세무사"}',
   now(), now())
on conflict (id) do update
  set email              = excluded.email,
      encrypted_password = excluded.encrypted_password,
      raw_user_meta_data = excluded.raw_user_meta_data;

-- auth.identities (이메일 로그인 연동)
insert into auth.identities (
  id, user_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
) values
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000001',
   '{"sub":"b0000000-0000-0000-0000-000000000001","email":"boss@hanbit.co.kr"}',
   'email', now(), now(), now()),
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000002',
   '{"sub":"b0000000-0000-0000-0000-000000000002","email":"team@hanbit.co.kr"}',
   'email', now(), now(), now()),
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000003',
   '{"sub":"b0000000-0000-0000-0000-000000000003","email":"tax@hanbit.co.kr"}',
   'email', now(), now(), now())
on conflict do nothing;

-- ============================================================
-- 2. hanbit.users — 프로필
-- ============================================================
insert into hanbit.users (id, email, name, role) values
  ('b0000000-0000-0000-0000-000000000001', 'boss@hanbit.co.kr', '박사장', '사장'),
  ('b0000000-0000-0000-0000-000000000002', 'team@hanbit.co.kr', '김팀장', '팀장'),
  ('b0000000-0000-0000-0000-000000000003', 'tax@hanbit.co.kr',  '이세무사', '세무사')
on conflict (id) do update
  set name = excluded.name,
      role = excluded.role;

-- ============================================================
-- 3. hanbit.sites — 3개 현장
-- ============================================================
insert into hanbit.sites (id, name, address, status) values
  ('c0000000-0000-0000-0000-000000000001',
   '강남 A동 202호', '서울 강남구 테헤란로 123 A동 202호', '진행중'),
  ('c0000000-0000-0000-0000-000000000002',
   '서초 오피스',    '서울 서초구 서초대로 456', '완료'),
  ('c0000000-0000-0000-0000-000000000003',
   '마포 카페',      '서울 마포구 홍대로 789', '진행중')
on conflict (id) do update
  set name    = excluded.name,
      address = excluded.address,
      status  = excluded.status;

-- ============================================================
-- 4. hanbit.policies — 4종 정책
-- ============================================================
insert into hanbit.policies (id, category, rule_type, limit_amount, banned_list, description) values
  -- 식대 한도 30,000원
  ('d0000000-0000-0000-0000-000000000001',
   '식대', 'limit', 30000, '{}',
   '1인 현장 식대 한도 30,000원'),
  -- 접대 한도 50,000원
  ('d0000000-0000-0000-0000-000000000002',
   '접대', 'limit', 50000, '{}',
   '1회 접대비 한도 50,000원'),
  -- 공구 한도 100,000원
  ('d0000000-0000-0000-0000-000000000003',
   '공구', 'limit', 100000, '{}',
   '1회 공구·자재 구매 한도 100,000원'),
  -- 금지업종 키워드
  ('d0000000-0000-0000-0000-000000000004',
   '금지업종', 'banned', null,
   '{"노래방","유흥","나이트","룸살롱","단란주점","카지노"}',
   '회사 지정 금지업종 키워드 필터')
on conflict (id) do update
  set category     = excluded.category,
      rule_type    = excluded.rule_type,
      limit_amount = excluded.limit_amount,
      banned_list  = excluded.banned_list,
      description  = excluded.description;

-- ============================================================
-- 5. hanbit.receipts — 10건
--    분류: 철물점 간이3 / 식대3(초과1) / 노래방1 / 공구2 / 현금1
-- ============================================================
insert into hanbit.receipts
  (id, site_id, user_id, date, merchant, biz_no,
   supply, vat, total, category, is_simplified, confidence, notes, status)
values

  -- ① 철물점 간이영수증 (신뢰도 낮음, 사업자 미확인)
  ('e0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',  -- 강남 A동
   'b0000000-0000-0000-0000-000000000002',  -- 김팀장
   current_date - 14, '강남 철물점', null,
   15000, 0, 15000, '공구', true, 0.72, null, 'pending'),

  -- ② 철물점 간이영수증 (신뢰도 낮음)
  ('e0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 12, '서초 철물점', null,
   20000, 0, 20000, '공구', true, 0.68, null, 'pending'),

  -- ③ 철물점 간이영수증 (신뢰도 낮음)
  ('e0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000003',  -- 마포 카페
   'b0000000-0000-0000-0000-000000000002',
   current_date - 10, '마포 인테리어 철물', null,
   18000, 0, 18000, '공구', true, 0.75, null, 'pending'),

  -- ④ 현장 식대 — 정상 (25,000 ≤ 30,000)
  ('e0000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 9, '강남 김밥나라', '101-23-45678',
   22727, 2273, 25000, '식대', false, 0.96, null, 'pending'),

  -- ⑤ 현장 식대 — 정상 (22,000 ≤ 30,000)
  ('e0000000-0000-0000-0000-000000000005',
   'c0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 8, '마포 순대국', '202-34-56789',
   20000, 2000, 22000, '식대', false, 0.94, null, 'pending'),

  -- ⑥ 현장 식대 — 한도 초과 (42,000 > 30,000)  ← 위반 발생
  ('e0000000-0000-0000-0000-000000000006',
   'c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 7, '강남 갈비집', '303-45-67890',
   38182, 3818, 42000, '식대', false, 0.93, null, 'pending'),

  -- ⑦ 노래방 — 금지업종  ← 위반 발생
  ('e0000000-0000-0000-0000-000000000007',
   'c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 5, '강남 노래방 황금성', '404-56-78901',
   72727, 7273, 80000, '접대', false, 0.88, null, 'pending'),

  -- ⑧ 공구 구매 — 정상 (85,000 ≤ 100,000)
  ('e0000000-0000-0000-0000-000000000008',
   'c0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 4, '홈디포 마포점', '505-67-89012',
   77273, 7727, 85000, '공구', false, 0.97, null, 'pending'),

  -- ⑨ 공구 구매 — 정상 (75,000 ≤ 100,000)
  ('e0000000-0000-0000-0000-000000000009',
   'c0000000-0000-0000-0000-000000000002',  -- 서초 오피스
   'b0000000-0000-0000-0000-000000000002',
   current_date - 3, '건자재마트 서초', '606-78-90123',
   68182, 6818, 75000, '공구', false, 0.95, null, 'pending'),

  -- ⑩ 외주 현금영수증 — 간이영수증(사업자 미확인)
  ('e0000000-0000-0000-0000-000000000010',
   'c0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000002',
   current_date - 2, '외주 인부 현금영수증', null,
   150000, 0, 150000, '소모품', true, 0.81, null, 'pending')

on conflict (id) do update
  set date          = excluded.date,
      merchant      = excluded.merchant,
      total         = excluded.total,
      category      = excluded.category,
      is_simplified = excluded.is_simplified,
      confidence    = excluded.confidence;

-- 외래키 복원
set session_replication_role = default;

-- ============================================================
-- 6. 정책 자동 검증 실행
--    위반 영수증: ⑥ 식대초과 / ⑦ 노래방 / ①②③ 간이영수증
-- ============================================================
select hanbit.check_policy_compliance(id)
  from hanbit.receipts
 where id in (
   'e0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-000000000004',
   'e0000000-0000-0000-0000-000000000005',
   'e0000000-0000-0000-0000-000000000006',
   'e0000000-0000-0000-0000-000000000007',
   'e0000000-0000-0000-0000-000000000008',
   'e0000000-0000-0000-0000-000000000009',
   'e0000000-0000-0000-0000-000000000010'
 );

-- ============================================================
-- 7. 시드 결과 확인 쿼리
-- ============================================================
-- 아래 select 문으로 결과를 확인하세요:

-- 영수증 + 위반 현황
-- select r.date, r.merchant, r.total, r.category, r.is_simplified,
--        r.confidence, r.notes,
--        count(v.id) as violation_count
--   from hanbit.receipts r
--   left join hanbit.violations v on v.receipt_id = r.id
--  group by r.id
--  order by r.date;

-- 위반 목록
-- select r.merchant, r.total, p.category, p.rule_type, v.reason, v.status
--   from hanbit.violations v
--   join hanbit.receipts r  on r.id = v.receipt_id
--   join hanbit.policies p  on p.id = v.policy_id
--  order by v.created_at;
