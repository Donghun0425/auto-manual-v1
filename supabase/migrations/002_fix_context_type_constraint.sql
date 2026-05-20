-- ============================================================
-- context_type CHECK 제약조건을 한글 값으로 변경
-- Supabase SQL Editor 에서 실행하세요
-- ============================================================

-- 기존 영문 CHECK 제약조건 제거
ALTER TABLE public.dictionary DROP CONSTRAINT IF EXISTS dictionary_context_type_check;

-- 한글 값으로 새 CHECK 제약조건 추가
ALTER TABLE public.dictionary ADD CONSTRAINT dictionary_context_type_check
  CHECK (context_type IN ('조회조건','그리드','처리조건','인포영역'));
