-- ============================================================
-- 매뉴얼 생성 결과 저장 (manual_result)
-- 생성된 분석결과(parse_result) · HTML · Markdown 을 DB 에 저장하여
-- 재생성 없이 기존 결과를 재사용하거나, 랜딩 페이지 히스토리에서 불러온다.
-- 식별 키: (file_name, source_hash) — 파일명 + 내용 해시
-- Supabase SQL Editor 에서 실행하세요.
-- ============================================================

-- ── 1. 테이블 ────────────────────────────────────────────────
-- file_name:   분석 파일명 (디렉터리 제외). 예) usc_3010501_u.clx.js
-- source_hash: 파일 내용 sha1 해시 (내용 변경 감지)
-- parse_result/html_content/markdown_content: 생성 결과물
CREATE TABLE IF NOT EXISTS public.manual_result (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name        TEXT NOT NULL,
  source_hash      TEXT NOT NULL,
  file_path        TEXT NOT NULL DEFAULT '',
  parse_result     JSONB NOT NULL,
  html_content     TEXT,
  markdown_content TEXT,
  token_usage      JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_formats   TEXT[] NOT NULL DEFAULT '{}',
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (file_name, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_manual_result_file_name  ON public.manual_result (file_name);
CREATE INDEX IF NOT EXISTS idx_manual_result_hash       ON public.manual_result (source_hash);
CREATE INDEX IF NOT EXISTS idx_manual_result_updated_at ON public.manual_result (updated_at DESC);

-- ── 2. updated_at 자동 갱신 트리거 (set_updated_at 은 001에서 생성됨) ──
DROP TRIGGER IF EXISTS trg_manual_result_updated_at ON public.manual_result;
CREATE TRIGGER trg_manual_result_updated_at
  BEFORE UPDATE ON public.manual_result
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RLS (1인 개발 도구이므로 전체 허용) ───────────────────
ALTER TABLE public.manual_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_manual_result" ON public.manual_result
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
