import { supabase } from "@/lib/supabase/client";
import type {
  LayoutTemplate,
  LayoutTemplateInsert,
  LayoutTemplateUpdate,
} from "@/types";

/** 레이아웃 템플릿 목록 조회 */
export async function listLayoutTemplates(): Promise<LayoutTemplate[]> {
  const { data, error } = await supabase
    .from("layout_template")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`템플릿 목록 조회 실패: ${error.message}`);
  return (data ?? []) as LayoutTemplate[];
}

/** 기본 레이아웃 템플릿 조회 (is_default = true 중 최신) */
export async function getDefaultLayoutTemplate(): Promise<LayoutTemplate | null> {
  const { data, error } = await supabase
    .from("layout_template")
    .select("*")
    .eq("is_default", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`기본 템플릿 조회 실패: ${error.message}`);
  return data as LayoutTemplate | null;
}

/** 레이아웃 템플릿 등록 */
export async function insertLayoutTemplate(
  input: LayoutTemplateInsert
): Promise<LayoutTemplate> {
  const { data, error } = await supabase
    .from("layout_template")
    .insert(input as unknown as Record<string, unknown>)
    .select()
    .single();

  if (error) throw new Error(`템플릿 등록 실패: ${error.message}`);
  return data as LayoutTemplate;
}

/** 레이아웃 템플릿 수정 */
export async function updateLayoutTemplate(
  id: string,
  input: LayoutTemplateUpdate
): Promise<LayoutTemplate> {
  const { data, error } = await supabase
    .from("layout_template")
    .update(input as Record<string, unknown>)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`템플릿 수정 실패: ${error.message}`);
  return data as LayoutTemplate;
}

/**
 * 기본 템플릿 설정 — 기존 기본값을 해제하고 지정 ID를 기본으로 변경
 * (트랜잭션 대신 순차 UPDATE로 처리)
 */
export async function setDefaultLayoutTemplate(id: string): Promise<void> {
  // 1) 기존 기본값 해제
  const { error: clearError } = await supabase
    .from("layout_template")
    .update({ is_default: false } as Record<string, unknown>)
    .eq("is_default", true);

  if (clearError) throw new Error(`기본 템플릿 해제 실패: ${clearError.message}`);

  // 2) 새 기본값 설정
  const { error: setError } = await supabase
    .from("layout_template")
    .update({ is_default: true } as Record<string, unknown>)
    .eq("id", id);

  if (setError) throw new Error(`기본 템플릿 설정 실패: ${setError.message}`);
}

/** 레이아웃 템플릿 삭제 */
export async function deleteLayoutTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("layout_template")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`템플릿 삭제 실패: ${error.message}`);
}
