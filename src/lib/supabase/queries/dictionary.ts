import { supabase } from "@/lib/supabase/client";
import type {
  Dictionary,
  DictionaryInsert,
  DictionaryUpdate,
  DictionaryCategory,
} from "@/types";

export interface DictionaryListParams {
  search?: string;        // term 또는 description 검색
  category?: DictionaryCategory | "all";
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
  page = 1,
  pageSize = 20,
}: DictionaryListParams = {}): Promise<DictionaryListResult> {
  let query = supabase
    .from("dictionary")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search.trim()) {
    query = query.or(
      `term.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
    );
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(`단어사전 조회 실패: ${error.message}`);

  return { data: (data ?? []) as Dictionary[], total: count ?? 0 };
}

/** 단어사전 단건 조회 (term 기준) — AI 호출 전 중복 확인용 */
export async function findDictionaryByTerm(
  term: string
): Promise<Dictionary | null> {
  const { data, error } = await supabase
    .from("dictionary")
    .select("*")
    .eq("term", term.trim())
    .maybeSingle();

  if (error) throw new Error(`단어 조회 실패: ${error.message}`);
  return data as Dictionary | null;
}

/**
 * 여러 term 을 한 번의 IN 쿼리로 일괄 조회한다.
 * 반환값: Map<term, description> — 사전에 없는 term 은 포함되지 않는다.
 * terms 가 빈 배열이면 즉시 빈 Map 반환 (DB 호출 없음).
 */
export async function findDictionaryByTerms(
  terms: string[]
): Promise<Map<string, string>> {
  if (terms.length === 0) return new Map();

  const trimmed = terms.map((t) => t.trim());
  const { data, error } = await supabase
    .from("dictionary")
    .select("term, description")
    .in("term", trimmed);

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
 * 단어사전 등록 (term PK 충돌 시 description·source·updated_at 갱신).
 * AI 자동 생성 결과나 수동 등록 모두 이 함수를 사용한다.
 */
export async function upsertDictionary(
  input: DictionaryInsert
): Promise<Dictionary> {
  const { data, error } = await supabase
    .from("dictionary")
    .upsert(input as unknown as Record<string, unknown>, { onConflict: "term" })
    .select()
    .single();

  if (error) throw new Error(`단어 등록/수정 실패: ${error.message}`);
  return data as Dictionary;
}

/** @deprecated upsertDictionary 를 사용하세요 */
export async function insertDictionary(
  input: DictionaryInsert
): Promise<Dictionary> {
  return upsertDictionary(input);
}

/** 단어사전 수정 */
export async function updateDictionary(
  term: string,
  input: DictionaryUpdate
): Promise<Dictionary> {
  const { data, error } = await supabase
    .from("dictionary")
    .update(input as Record<string, unknown>)
    .eq("term", term)
    .select()
    .single();

  if (error) throw new Error(`단어 수정 실패: ${error.message}`);
  return data as Dictionary;
}

/** 단어사전 삭제 */
export async function deleteDictionary(term: string): Promise<void> {
  const { error } = await supabase.from("dictionary").delete().eq("term", term);
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
