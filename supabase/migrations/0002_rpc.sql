-- ============================================================
-- hanbit.check_policy_compliance(receipt_id uuid)
-- 영수증 정책 자동 검증 (3종 + 부가 처리)
--
-- 검증 규칙:
--   1) limit  : 카테고리별 한도 초과
--              식대 30,000원 / 접대 50,000원 / 공구 100,000원
--   2) banned : 금지업종 (노래방·유흥·나이트·룸살롱)
--   3) is_simplified = true → notes 에 [사업자미확인] 자동 표시
--   4) confidence < 0.85   → notes 에 [확인요망] 자동 표시
--
-- violations INSERT: pending 상태로 자동 기록 (2단계 결재 대기)
-- 반환: jsonb { violations, violation_count, confidence_flag }
-- ============================================================

create or replace function hanbit.check_policy_compliance(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  r              hanbit.receipts%rowtype;
  pol            hanbit.policies%rowtype;
  v_reason       text;
  v_flagged      boolean := false;
  v_results      jsonb   := '[]'::jsonb;
  v_banned_hit   text;
begin
  -- ── 영수증 로드 ─────────────────────────────────────────────
  select * into r from hanbit.receipts where id = p_receipt_id;
  if not found then
    raise exception '영수증을 찾을 수 없습니다: %', p_receipt_id;
  end if;

  -- 기존 pending 위반 삭제 (재검증 대비)
  delete from hanbit.violations
   where receipt_id = p_receipt_id and status = 'pending';

  -- ── (1) 한도 초과 검사 (limit) ───────────────────────────────
  for pol in
    select * from hanbit.policies
     where active = true
       and rule_type = 'limit'
       and category = r.category
  loop
    if r.total > coalesce(pol.limit_amount, 0) then
      v_reason := format(
        '[한도초과] %s 한도 %s원, 결제 %s원 (초과 %s원)',
        pol.category,
        to_char(pol.limit_amount, 'FM999,999,999'),
        to_char(r.total,          'FM999,999,999'),
        to_char(r.total - pol.limit_amount, 'FM999,999,999')
      );
      insert into hanbit.violations(receipt_id, policy_id, reason)
      values (r.id, pol.id, v_reason)
      on conflict (receipt_id, policy_id) do update
        set reason = excluded.reason;

      v_results := v_results || jsonb_build_object(
        'rule', 'limit', 'policy_id', pol.id, 'reason', v_reason
      );
    end if;
  end loop;

  -- ── (2) 금지업종 검사 (banned) ───────────────────────────────
  for pol in
    select * from hanbit.policies
     where active = true
       and rule_type = 'banned'
       and category = '금지업종'
  loop
    select x into v_banned_hit
      from unnest(pol.banned_list) as x
     where r.merchant ilike '%' || x || '%'
     limit 1;

    if v_banned_hit is not null then
      v_reason := format('[금지업종] 키워드 "%s" 매칭: %s', v_banned_hit, r.merchant);
      insert into hanbit.violations(receipt_id, policy_id, reason)
      values (r.id, pol.id, v_reason)
      on conflict (receipt_id, policy_id) do update
        set reason = excluded.reason;

      v_results := v_results || jsonb_build_object(
        'rule', 'banned', 'policy_id', pol.id, 'reason', v_reason
      );
    end if;
  end loop;

  -- ── (3) 간이영수증 → [사업자미확인] ────────────────────────────
  if r.is_simplified then
    v_flagged := true;
    if coalesce(r.notes, '') not like '%[사업자미확인]%' then
      update hanbit.receipts
         set notes = case
               when r.notes is null or r.notes = ''
               then '[사업자미확인] 간이영수증'
               else '[사업자미확인] ' || r.notes
             end
       where id = r.id;
    end if;
  end if;

  -- ── (4) 신뢰도 < 0.85 → [확인요망] ─────────────────────────
  if r.confidence < 0.85 then
    v_flagged := true;
    if coalesce(r.notes, '') not like '%[확인요망]%' then
      update hanbit.receipts
         set notes = case
               when notes is null or notes = ''
               then '[확인요망] OCR 신뢰도 낮음'
               else '[확인요망] ' || notes
             end
       where id = r.id;
    end if;
  end if;

  return jsonb_build_object(
    'receipt_id',      r.id,
    'violations',      v_results,
    'violation_count', jsonb_array_length(v_results),
    'confidence_flag', v_flagged,
    'confidence',      r.confidence
  );
end;
$$;

grant execute on function hanbit.check_policy_compliance(uuid) to authenticated, anon;

-- ============================================================
-- hanbit.site_cost_summary()
-- /sites 화면용: 현장별 원가 현황 집계
-- ============================================================
create or replace function hanbit.site_cost_summary()
returns table (
  site_id          uuid,
  site_name        text,
  site_status      text,
  receipt_count    bigint,
  total_amount     numeric,
  violation_count  bigint,
  pending_count    bigint
)
language sql
stable
security definer
as $$
  select
    s.id                                            as site_id,
    s.name                                          as site_name,
    s.status                                        as site_status,
    count(distinct r.id)                            as receipt_count,
    coalesce(sum(r.total), 0)                       as total_amount,
    count(distinct v.id)                            as violation_count,
    count(distinct v.id) filter (
      where v.status = 'pending'
    )                                               as pending_count
  from hanbit.sites s
  left join hanbit.receipts r   on r.site_id = s.id
  left join hanbit.violations v on v.receipt_id = r.id
  group by s.id, s.name, s.status
  order by s.created_at;
$$;

grant execute on function hanbit.site_cost_summary() to authenticated;

-- ============================================================
-- hanbit.monthly_kpi(p_year int, p_month int)
-- /dashboard 화면용: 월간 KPI 집계
-- ============================================================
create or replace function hanbit.monthly_kpi(p_year int, p_month int)
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object(
    'total_receipts',    count(r.id),
    'total_amount',      coalesce(sum(r.total), 0),
    'approved',          count(r.id) filter (where r.status = 'approved'),
    'rejected',          count(r.id) filter (where r.status = 'rejected'),
    'pending',           count(r.id) filter (where r.status = 'pending'),
    'flagged',           count(r.id) filter (where r.confidence < 0.85),
    'simplified',        count(r.id) filter (where r.is_simplified = true),
    'violations_total',  count(distinct v.id),
    'violations_pending',count(distinct v.id) filter (where v.status = 'pending'),
    'by_site', (
      select jsonb_agg(jsonb_build_object(
        'site_id', s.id,
        'site_name', s.name,
        'amount', coalesce(sum2.amount, 0),
        'count',  coalesce(sum2.cnt, 0)
      ))
      from hanbit.sites s
      left join (
        select site_id,
               sum(total) as amount,
               count(*)   as cnt
          from hanbit.receipts
         where date_part('year', date)  = p_year
           and date_part('month', date) = p_month
         group by site_id
      ) sum2 on sum2.site_id = s.id
    ),
    'by_category', (
      select jsonb_object_agg(
        coalesce(category, '미분류'),
        sum(total)
      )
      from hanbit.receipts
      where date_part('year', date)  = p_year
        and date_part('month', date) = p_month
    )
  )
  from hanbit.receipts r
  left join hanbit.violations v on v.receipt_id = r.id
  where date_part('year', r.date)  = p_year
    and date_part('month', r.date) = p_month;
$$;

grant execute on function hanbit.monthly_kpi(int, int) to authenticated;
