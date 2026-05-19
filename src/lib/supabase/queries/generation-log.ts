import { supabase } from "@/lib/supabase/client";
import type { GenerationLog, GenerationLogInsert } from "@/types";

/** 생성 로그 기록 */
export async function insertGenerationLog(
  input: GenerationLogInsert
): Promise<GenerationLog> {
  const { data, error } = await supabase
    .from("generation_log")
    .insert(input as unknown as Record<string, unknown>)
    .select()
    .single();

  if (error) throw new Error(`생성 로그 기록 실패: ${error.message}`);
  return data as GenerationLog as GenerationLog;
}

/** 최근 생성 로그 목록 (대시보드 히스토리용) */
export async function listRecentGenerationLogs(
  limit = 10
): Promise<GenerationLog[]> {
  const { data, error } = await supabase
    .from("generation_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`생성 로그 조회 실패: ${error.message}`);
  return (data ?? []) as GenerationLog[];
}
