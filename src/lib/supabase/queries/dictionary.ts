import { supabase } from "@/lib/supabase/client";
import type {
  Dictionary,
  DictionaryInsert,
  DictionaryUpdate,
  DictionaryCategory,
  DictionaryContextType,
} from "@/types";

export interface DictionaryListParams {
  search?: string;        // term 또는 description 검색
  category?: DictionaryCategory | "all";
  contextType?: DictionaryContextType | "all";
  page?: number;          // 1-based
  pageSize?: number;
}

export interface DictionaryListResult {
  data: Dictionary[];
  total: number;
}

/** 단어사전 목록 조회 (검색·필터·페이지네이션) */
export async function listDictionary({
  search = "",
  category = "all",
  contextType = "all",
  page = 1,
  pageSize = 20,
}: DictionaryListParams = {}): Promise<DictionaryListResult> {
  let query = supabase
    .from("dictionary")
    .select("*", { count: "exact" })
    .order("term", { ascending: true })
    .order("context_type", { ascending: true });

  if (search.trim()) {
    query = query.or(
      `term.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
    );
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (contextType && contextType !== "all") {
    query = query.eq("context_type", contextType);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(`단어사전 조회 실패: ${error.message}`);

  return { data: (data ?? []) as Dictionary[], total: count ?? 0 };
}

/** 단어사전 단건 조회 (term + context_type 기준) */
export async function findDictionaryByTerm(
  term: string,
  contextType: DictionaryContextType
): Promise<Dictionary | null> {
  const { data, error } = await supabase
    .from("dictionary")
    .select("*")
    .eq("term", term.trim())
    .eq("context_type", contextType)
    .maybeSingle();

  if (error) throw new Error(`단어 조회 실패: ${error.message}`);
  return data as Dictionary | null;
}

/**
 * 여러 term 을 한 번의 IN 쿼리로 일괄 조회시킵니다. (context_type 별 조회)
 * 반환값: Map<term, description> — 사전에 없는 term 은 포함되지 않습니다.
 * terms 가 빈 배열이면 즉시 빈 Map 반환 (DB 호출 없음).
 */
export async function findDictionaryByTerms(
  terms: string[],
  contextType: DictionaryContextType
): Promise<Map<string, string>> {
  if (terms.length === 0) return new Map();

  const trimmed = terms.map((t) => t.trim());
  const { data, error } = await supabase
    .from("dictionary")
    .select("term, description")
    .in("term", trimmed)
    .eq("context_type", contextType);

  if (error) throw new Error(`단어 일괄 조회 실패: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!map.has(row.term)) {
      map.set(row.term, (row as { term: string; description: string }).description);
    }
  }
  return map;
}

/**
 * 단어사전 등록 (PK (term, context_type) 충돌 시 description·source·updated_at 갱신).
 */
export async function upsertDictionary(
  input: DictionaryInsert
): Promise<Dictionary> {
  const { data, error } = await supabase
    .from("dictionary")
    .upsert(input as unknown as Record<string, unknown>, { onConflict: "term,context_type" })
    .select()
    .single();

  if (error) throw new Error(`단어 등록/수정 실패: ${error.message}`);
  return data as Dictionary;
}

/** 단어사전 수정 (term + context_type 으로 행 특정) */
export async function updateDictionary(
  term: string,
  contextType: DictionaryContextType,
  input: DictionaryUpdate
): Promise<Dictionary> {
  const { data, error } = await supabase
    .from("dictionary")
    .update(input as Record<string, unknown>)
    .eq("term", term)
    .eq("context_type", contextType)
    .select()
    .single();

  if (error) throw new Error(`단어 수정 실패: ${error.message}`);
  return data as Dictionary;
}

/** 단어사전 삭제 (term + context_type 으로 행 특정) */
export async function deleteDictionary(
  term: string,
  contextType: DictionaryContextType
): Promise<void> {
  const { error } = await supabase
    .from("dictionary")
    .delete()
    .eq("term", term)
    .eq("context_type", contextType);
  if (error) throw new Error(`단어 삭제 실패: ${error.message}`);
}

/** 단어사전 통계 조회 (대시보드·헤더 카운트용) */
export async function getDictionaryStats(): Promise<{
  total: number;
  aiCount: number;
  manualCount: number;
}> {
  const [totalRes, aiRes] = await Promise.all([
    supabase.from("dictionary").select("*", { count: "exact", head: true }),
    supabase
      .from("dictionary")
      .select("*", { count: "exact", head: true })
      .eq("source", "ai"),
  ]);

  if (totalRes.error) throw new Error(`통계 조회 실패: ${totalRes.error.message}`);
  if (aiRes.error) throw new Error(`통계 조회 실패: ${aiRes.error.message}`);

  const total = totalRes.count ?? 0;
  const aiCount = aiRes.count ?? 0;
  return { total, aiCount, manualCount: total - aiCount };
}
