-- ============================================================
-- CLX 매뉴얼 자동생성기 초기 스키마
-- Supabase SQL Editor 에서 실행하세요
-- ============================================================

-- ── 1. 단어사전 (dictionary) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dictionary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (
                category IN ('공통','학사','행정','연구','부속','기타')
              ),
  description TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dictionary_term     ON public.dictionary (term);
CREATE INDEX IF NOT EXISTS idx_dictionary_category ON public.dictionary (category);
CREATE INDEX IF NOT EXISTS idx_dictionary_user_id  ON public.dictionary (user_id);

-- 검색 속도를 위한 Full-Text Search 인덱스
CREATE INDEX IF NOT EXISTS idx_dictionary_fts
  ON public.dictionary
  USING gin(to_tsvector('simple', term || ' ' || description));

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dictionary_updated_at ON public.dictionary;
CREATE TRIGGER trg_dictionary_updated_at
  BEFORE UPDATE ON public.dictionary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. 레이아웃 템플릿 (layout_template) ─────────────────────
CREATE TABLE IF NOT EXISTS public.layout_template (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  sections   JSONB NOT NULL DEFAULT '[]'::JSONB,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layout_template_user_id  ON public.layout_template (user_id);
CREATE INDEX IF NOT EXISTS idx_layout_template_default  ON public.layout_template (is_default);

-- 사용자당 기본 템플릿은 1개만 허용 (user_id 가 NULL 인 공용 기본값 제외)
CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_template_one_default
  ON public.layout_template (user_id)
  WHERE is_default = true AND user_id IS NOT NULL;

-- ── 3. 생성 로그 (generation_log) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.generation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   TEXT NOT NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('html','md')),
  token_usage INTEGER NOT NULL DEFAULT 0,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_log_user_id   ON public.generation_log (user_id);
CREATE INDEX IF NOT EXISTS idx_generation_log_created   ON public.generation_log (created_at DESC);

-- ── 4. RLS (Row Level Security) 정책 ─────────────────────────
-- 인증 없이도 동작하도록 anon 역할에도 권한 부여
-- (1인 개발 도구이므로 단순화; 필요 시 user_id 기반 정책으로 교체)

ALTER TABLE public.dictionary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layout_template  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_log   ENABLE ROW LEVEL SECURITY;

-- dictionary: 로그인 없이 전체 허용
CREATE POLICY "allow_all_dictionary" ON public.dictionary
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- layout_template: 로그인 없이 전체 허용
CREATE POLICY "allow_all_layout_template" ON public.layout_template
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- generation_log: 로그인 없이 전체 허용
CREATE POLICY "allow_all_generation_log" ON public.generation_log
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
