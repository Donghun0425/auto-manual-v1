-- ============================================================
-- UDC(User Defined Component) 분석 데이터 스키마
-- udc.js 를 파싱하여 컴포넌트별 메타데이터·컨트롤·프로퍼티·함수·데이터셋을 저장
-- 핵심 설계: Property → Control 매핑을 통한 동적 라벨 해석
-- Supabase SQL Editor 에서 실행하세요
-- ============================================================

-- ── 1. UDC 마스터 (udc_component) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.udc_component (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name     TEXT NOT NULL UNIQUE,            -- 단축명 (AacAcntgComnt)
  qualified_name TEXT NOT NULL,                   -- 전체명 (udc.admin.AacAcntgComnt)
  display_name   TEXT NOT NULL,                   -- 한글명 (회계 콤보)
  component_type TEXT NOT NULL,                   -- combo, cascading_combo, grid, info, file_upload, button_bar, utility, editor, report, finder
  category       TEXT NOT NULL,                   -- 공통, 학사, 행정, 연구, 부속, 기타
  description    TEXT,                            -- 상세 설명
  author         TEXT,                            -- 작성자
  version        TEXT,                            -- 버전
  section_usage  TEXT[] NOT NULL DEFAULT '{}',    -- 사용 섹션 (조회조건, 처리조건, 인포영역, 타이틀바, 그리드)
  source_hash    TEXT,                            -- 블록 해시 (변경 감지)
  raw_metadata   JSONB,                           -- 원본 메타데이터
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_udc_component_short_name ON public.udc_component (short_name);
CREATE INDEX IF NOT EXISTS idx_udc_component_type       ON public.udc_component (component_type);
CREATE INDEX IF NOT EXISTS idx_udc_component_category   ON public.udc_component (category);

-- 라벨/이름/설명 검색용 Full-Text Search 인덱스
CREATE INDEX IF NOT EXISTS idx_udc_component_fts
  ON public.udc_component
  USING gin(to_tsvector('simple',
    short_name || ' ' || display_name || ' ' || coalesce(description, '')));

-- ── 2. 내부 UI 컨트롤 (udc_control) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.udc_control (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  udc_id            UUID NOT NULL REFERENCES public.udc_component(id) ON DELETE CASCADE,
  control_id        TEXT NOT NULL,                -- 컨트롤 ID (T_ACNTG_YR, ACNTG_YR, DG_GRID01)
  control_type      TEXT NOT NULL,               -- label, combo, input, output, button, grid, group, dataset
  default_label     TEXT,                        -- 기본 라벨 텍스트 ("회계년도")
  bind_dataset      TEXT,                        -- 바인딩 DataSet (ds_acntgYr)
  display_order     INTEGER NOT NULL DEFAULT 0,  -- 표시 순서
  is_label_control  BOOLEAN NOT NULL DEFAULT false, -- T_ 접두사 라벨 컨트롤 여부
  paired_control_id TEXT,                        -- 라벨↔입력 쌍 (T_ACNTG_YR ↔ ACNTG_YR)
  action_type       TEXT,                        -- 버튼/그리드 동작 유형: popup, service, function, confirm
  action_target     TEXT,                        -- 대상: 팝업 URL, 서비스명/메소드, 함수명
  action_params     JSONB,                       -- 부가정보: {width, height, callback, message, event}
  grid_columns      JSONB,                       -- control_type=grid 일 때: [{header, columnName, width, index}]
  cascade_config    JSONB,                       -- 캐스케이드: {triggeredBy, reloadMethod, paramMapping:[{from,to}]}
  UNIQUE (udc_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_udc_control_udc_id     ON public.udc_control (udc_id);
CREATE INDEX IF NOT EXISTS idx_udc_control_type       ON public.udc_control (control_type);
CREATE INDEX IF NOT EXISTS idx_udc_control_label      ON public.udc_control (default_label);

-- ── 3. 노출 프로퍼티 + Control 매핑 (udc_property) ⭐핵심 ────
CREATE TABLE IF NOT EXISTS public.udc_property (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  udc_id            UUID NOT NULL REFERENCES public.udc_component(id) ON DELETE CASCADE,
  property_name     TEXT NOT NULL,               -- 프로퍼티명 (acntgYrLabel)
  property_group    TEXT NOT NULL,               -- label, width, visible, enable, value, filter, headType, bind
  default_value     TEXT,                        -- 기본값 ("회계년도", "60", "true")
  data_type         TEXT NOT NULL,               -- string, boolean, number
  target_control_id TEXT,                        -- 영향 받는 컨트롤 ID (T_ACNTG_YR)
  target_attribute  TEXT,                        -- 영향 받는 속성 (text, visible, enabled, width, value)
  UNIQUE (udc_id, property_name)
);

CREATE INDEX IF NOT EXISTS idx_udc_property_udc_id ON public.udc_property (udc_id);
CREATE INDEX IF NOT EXISTS idx_udc_property_target ON public.udc_property (target_control_id);

-- ── 4. export 함수 + 매핑 (udc_function) ⭐핵심 ─────────────
CREATE TABLE IF NOT EXISTS public.udc_function (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  udc_id            UUID NOT NULL REFERENCES public.udc_component(id) ON DELETE CASCADE,
  function_name     TEXT NOT NULL,               -- 함수명 (setAcntgYrLabel)
  function_type     TEXT NOT NULL,               -- init, set_label, set_visible, set_enable, set_width, get, event
  parameters        JSONB NOT NULL DEFAULT '[]', -- [{name, type, description, position}]
  target_properties TEXT[] NOT NULL DEFAULT '{}',-- 영향 받는 프로퍼티 ["acntgYrLabel"]
  target_controls   JSONB NOT NULL DEFAULT '[]', -- [{control_id, attribute}]
  is_exported       BOOLEAN NOT NULL DEFAULT true,
  description       TEXT,
  UNIQUE (udc_id, function_name)
);

CREATE INDEX IF NOT EXISTS idx_udc_function_udc_id ON public.udc_function (udc_id);
CREATE INDEX IF NOT EXISTS idx_udc_function_type   ON public.udc_function (function_type);

-- ── 5. DataSet (udc_dataset) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.udc_dataset (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  udc_id           UUID NOT NULL REFERENCES public.udc_component(id) ON DELETE CASCADE,
  dataset_name     TEXT NOT NULL,                -- ds_acntgYr
  bound_control_id TEXT,                         -- 바인딩 컨트롤 (ACNTG_YR)
  code_column      TEXT,                         -- 코드 컬럼명
  name_column      TEXT,                         -- 명칭 컬럼명
  service_url      TEXT,                         -- 서비스 호출 URL
  UNIQUE (udc_id, dataset_name)
);

CREATE INDEX IF NOT EXISTS idx_udc_dataset_udc_id ON public.udc_dataset (udc_id);

-- ── 6. 업로드 이력 (udc_upload_log) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.udc_upload_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name       TEXT NOT NULL,                 -- 업로드 파일명
  file_hash       TEXT NOT NULL,                 -- 전체 파일 해시
  component_count INTEGER NOT NULL DEFAULT 0,    -- 파싱된 UDC 수
  upserted_count  INTEGER NOT NULL DEFAULT 0,    -- 신규/수정 수
  unchanged_count INTEGER NOT NULL DEFAULT 0,    -- 변경없음 수
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_udc_upload_log_uploaded ON public.udc_upload_log (uploaded_at DESC);

-- ── updated_at 자동 갱신 트리거 (set_updated_at 은 001에서 생성됨) ──
DROP TRIGGER IF EXISTS trg_udc_component_updated_at ON public.udc_component;
CREATE TRIGGER trg_udc_component_updated_at
  BEFORE UPDATE ON public.udc_component
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (Row Level Security) 정책 ────────────────────────────
-- 1인 개발 도구이므로 anon/authenticated 전체 허용 (기존 패턴 동일)
ALTER TABLE public.udc_component  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udc_control    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udc_property   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udc_function   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udc_dataset    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udc_upload_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_udc_component" ON public.udc_component
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_udc_control" ON public.udc_control
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_udc_property" ON public.udc_property
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_udc_function" ON public.udc_function
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_udc_dataset" ON public.udc_dataset
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_udc_upload_log" ON public.udc_upload_log
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
