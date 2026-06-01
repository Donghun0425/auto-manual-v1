-- ============================================================
-- 화면 이미지 관리 (screen_image)
-- 분석 파일과 동일한 기본 파일명으로 업로드한 화면 캡처 이미지를
-- 중앙에서 관리하고, 결과 페이지에 자동 적용한다.
-- Supabase SQL Editor 에서 실행하세요.
-- ============================================================

-- ── 1. 테이블 ────────────────────────────────────────────────
-- file_base: 분석 파일 기본명 (디렉터리·확장자 제거). 예) usc_3010501_t01
-- storage_path: Storage 버킷 'screen-images' 내부 경로
CREATE TABLE IF NOT EXISTS public.screen_image (
  file_base     TEXT PRIMARY KEY,
  storage_path  TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'image/png',
  original_name TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. RLS (1인 개발 도구이므로 전체 허용) ───────────────────
ALTER TABLE public.screen_image ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_screen_image" ON public.screen_image
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── 3. Storage 버킷 ──────────────────────────────────────────
-- 'screen-images' 버킷(public)을 생성한다. 이미 있으면 무시.
INSERT INTO storage.buckets (id, name, public)
VALUES ('screen-images', 'screen-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 객체 접근 정책 (anon/authenticated 전체 허용)
CREATE POLICY "allow_all_screen_images_objects" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'screen-images')
  WITH CHECK (bucket_id = 'screen-images');
