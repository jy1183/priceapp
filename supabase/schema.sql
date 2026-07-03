-- 주변 가격 분석 앱 — Supabase(PostgreSQL) 스키마 (Phase 0/3)
-- 프로젝트 단위 저장: 입력 데이터 + 분석 결과 + 적용 변수·필터 스냅샷

create extension if not exists "pgcrypto";

-- 검토 프로젝트
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_sido text,
  region_sigungu text,
  region_dong text,
  lawd_cd text,                       -- 법정동 시군구 5자리
  config jsonb not null default '{}', -- 분석환경설정 스냅샷(자본환원율/보증금운영수익률+메모/상위기준)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 시세 입력(파싱 확정본)
create table if not exists sise_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  facility text,
  deal text,               -- 매매/전세/월세
  amount_cheonwon numeric,
  monthly_rent_cheonwon numeric,
  supply_m2 numeric,
  excl_m2 numeric,
  daeji_m2 numeric,
  yeon_m2 numeric,
  raw jsonb,               -- 원문/파싱 추적
  created_at timestamptz not null default now()
);

-- 실거래 조회 원본(시설/거래/월 단위 캐시)
create table if not exists tx_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  facility text not null,
  trade text not null,     -- 매매/전월세
  deal_ym text,            -- YYYYMM
  build_year int,          -- 준공연도
  amount_manwon numeric,
  deposit_manwon numeric,
  monthly_rent_manwon numeric,
  area_m2 numeric,
  ppa numeric,             -- 산출 평당가(천원/평)
  item jsonb,              -- API 원본 item 전체
  created_at timestamptz not null default now()
);

-- 분석 결과 스냅샷(재조회 재현용) + 검증 요약
create table if not exists analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null,      -- 'summary' | 'sise' | 'tx' | 'validation'
  filters jsonb,           -- 적용 기간·시설·면적 필터
  config jsonb,            -- 적용 변수
  result jsonb,            -- 집계 결과
  created_at timestamptz not null default now()
);

create index if not exists idx_sise_project on sise_rows(project_id);
create index if not exists idx_tx_project on tx_rows(project_id, facility, trade);
create index if not exists idx_snap_project on analysis_snapshots(project_id, kind);
