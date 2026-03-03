-- ccusage-worv Supabase 마이그레이션
-- Supabase SQL Editor에서 실행하세요

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES team_members(id),
  session_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  project_name TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_member ON usage_records(member_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded ON usage_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id);

-- 중복 전송 방지: 같은 세션+멤버+모델 조합은 덮어쓰기
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_unique_session_model
  ON usage_records(session_id, member_id, model);

-- 2. RPC 함수: 일별 사용량
CREATE OR REPLACE FUNCTION get_daily_usage(since_date TIMESTAMPTZ)
RETURNS TABLE (
  date TEXT,
  "memberName" TEXT,
  model TEXT,
  "inputTokens" BIGINT,
  "outputTokens" BIGINT,
  "cacheCreationTokens" BIGINT,
  "cacheReadTokens" BIGINT,
  "costUsd" DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    tm.name AS "memberName",
    ur.model,
    SUM(ur.input_tokens)::BIGINT AS "inputTokens",
    SUM(ur.output_tokens)::BIGINT AS "outputTokens",
    SUM(ur.cache_creation_tokens)::BIGINT AS "cacheCreationTokens",
    SUM(ur.cache_read_tokens)::BIGINT AS "cacheReadTokens",
    SUM(ur.cost_usd) AS "costUsd"
  FROM usage_records ur
  JOIN team_members tm ON ur.member_id = tm.id
  WHERE ur.recorded_at >= since_date
  GROUP BY to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), tm.name, ur.model
  ORDER BY date DESC;
$$;

-- 3. RPC 함수: 팀원별 사용량
CREATE OR REPLACE FUNCTION get_member_usage(since_date TIMESTAMPTZ)
RETURNS TABLE (
  "memberName" TEXT,
  "totalCost" DOUBLE PRECISION,
  "totalTokens" BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    tm.name AS "memberName",
    SUM(ur.cost_usd) AS "totalCost",
    SUM(ur.input_tokens + ur.output_tokens)::BIGINT AS "totalTokens"
  FROM usage_records ur
  JOIN team_members tm ON ur.member_id = tm.id
  WHERE ur.recorded_at >= since_date
  GROUP BY tm.name
  ORDER BY "totalCost" DESC;
$$;

-- 4. RPC 함수: 모델 분포
CREATE OR REPLACE FUNCTION get_model_distribution(since_date TIMESTAMPTZ)
RETURNS TABLE (
  model TEXT,
  count BIGINT,
  "totalCost" DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    model,
    COUNT(*)::BIGINT AS count,
    SUM(cost_usd) AS "totalCost"
  FROM usage_records
  WHERE recorded_at >= since_date
  GROUP BY model
  ORDER BY "totalCost" DESC;
$$;

-- 5. RLS 비활성화 (서버 사이드에서만 접근하므로)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- service_role 키로 접근하므로 RLS 바이패스됨

-- 6. budget_configs 테이블: 팀원별 예산 설정
CREATE TABLE IF NOT EXISTS budget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES team_members(id),
  budget_type TEXT NOT NULL CHECK (budget_type IN ('weekly', 'monthly')),
  budget_usd DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, budget_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_configs_team_default
  ON budget_configs(budget_type) WHERE member_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_budget_configs_member
  ON budget_configs(member_id);

ALTER TABLE budget_configs ENABLE ROW LEVEL SECURITY;

-- 7. RPC 함수: 팀원별 예산 대비 사용량
CREATE OR REPLACE FUNCTION get_member_budget_usage(
  period_type TEXT,
  period_start TIMESTAMPTZ
)
RETURNS TABLE (
  "memberId" UUID,
  "memberName" TEXT,
  "budgetUsd" DOUBLE PRECISION,
  "usedUsd" DOUBLE PRECISION,
  "usagePercent" DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    tm.id AS "memberId",
    tm.name AS "memberName",
    COALESCE(bc_member.budget_usd, bc_default.budget_usd, 0) AS "budgetUsd",
    COALESCE(SUM(ur.cost_usd), 0) AS "usedUsd",
    CASE
      WHEN COALESCE(bc_member.budget_usd, bc_default.budget_usd, 0) = 0 THEN 0
      ELSE ROUND(
        ((COALESCE(SUM(ur.cost_usd), 0) / COALESCE(bc_member.budget_usd, bc_default.budget_usd, 1)) * 100)::numeric,
        1
      )::DOUBLE PRECISION
    END AS "usagePercent"
  FROM team_members tm
  LEFT JOIN usage_records ur ON ur.member_id = tm.id AND ur.recorded_at >= period_start
  LEFT JOIN budget_configs bc_member ON bc_member.member_id = tm.id AND bc_member.budget_type = period_type
  LEFT JOIN budget_configs bc_default ON bc_default.member_id IS NULL AND bc_default.budget_type = period_type
  GROUP BY tm.id, tm.name, bc_member.budget_usd, bc_default.budget_usd
  ORDER BY "usedUsd" DESC;
$$;

-- 8. RPC 함수: 사용 속도(velocity)
CREATE OR REPLACE FUNCTION get_usage_velocity(since_date TIMESTAMPTZ)
RETURNS TABLE (
  "memberId" UUID,
  "memberName" TEXT,
  "dailyAvgUsd" DOUBLE PRECISION,
  "activeDays" INTEGER
) LANGUAGE sql STABLE AS $$
  SELECT
    tm.id AS "memberId",
    tm.name AS "memberName",
    CASE
      WHEN COUNT(DISTINCT to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')) = 0 THEN 0
      ELSE ROUND(
        SUM(ur.cost_usd)::numeric / COUNT(DISTINCT to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
        2
      )::DOUBLE PRECISION
    END AS "dailyAvgUsd",
    COUNT(DISTINCT to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'))::INTEGER AS "activeDays"
  FROM team_members tm
  LEFT JOIN usage_records ur ON ur.member_id = tm.id AND ur.recorded_at >= since_date
  GROUP BY tm.id, tm.name
  ORDER BY "dailyAvgUsd" DESC;
$$;

-- 9. RPC 함수: 예산 upsert
CREATE OR REPLACE FUNCTION upsert_budget(
  p_member_id UUID,
  p_budget_type TEXT,
  p_budget_usd DOUBLE PRECISION
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_member_id IS NULL THEN
    INSERT INTO budget_configs (member_id, budget_type, budget_usd, updated_at)
    VALUES (NULL, p_budget_type, p_budget_usd, now())
    ON CONFLICT (budget_type) WHERE member_id IS NULL
    DO UPDATE SET budget_usd = p_budget_usd, updated_at = now();
  ELSE
    INSERT INTO budget_configs (member_id, budget_type, budget_usd, updated_at)
    VALUES (p_member_id, p_budget_type, p_budget_usd, now())
    ON CONFLICT (member_id, budget_type)
    DO UPDATE SET budget_usd = p_budget_usd, updated_at = now();
  END IF;
END;
$$;
