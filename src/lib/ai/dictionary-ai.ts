/**
 * 단어사전 연동 AI 설명 생성기
 * 사전 우선 조회 → 미존재 시 AI 호출 → 자동 INSERT
 */
import { findDictionaryByTerm, insertDictionary } from "@/lib/supabase/queries/dictionary";
import { callAi, extractContent } from "./client";
import type { AiSettings, AiMessage, AiUsage, AiGenerationResult } from "@/types";

/**
 * 단어사전 우선 조회, 없으면 AI 생성 후 사전에 자동 등록
 */
export async function getDescriptionWithDictionary(
  term: string,
  category: string,
  promptMessages: AiMessage[],
  settings: AiSettings,
  options?: { skipInsert?: boolean }
): Promise<AiGenerationResult> {
  // 1. 단어사전에서 우선 조회
  try {
    const existing = await findDictionaryByTerm(term);
    if (existing) {
      return {
        term,
        description: existing.description,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        fromDictionary: true,
      };
    }
  } catch {
    // 사전 조회 실패 시 AI 호출로 fallback
  }

  // 2. AI 호출
  const response = await callAi(settings, promptMessages);
  const description = extractContent(response);
  const usage: AiUsage = response.usage ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  // 3. 사전에 자동 등록 (실패해도 무시)
  if (!options?.skipInsert && description) {
    try {
      await insertDictionary({
        term,
        category: mapToCategory(category),
        description,
        source: "ai",
      });
    } catch {
      // 등록 실패 무시 (중복 등)
    }
  }

  return { term, description, usage, fromDictionary: false };
}

/**
 * 카테고리 문자열을 DictionaryCategory로 매핑
 * 파일명 기반 카테고리(공통/학사/행정/미정)를 그대로 전달받거나,
 * 레거시 키(grid/condition 등)인 경우 공통으로 폴백
 */
function mapToCategory(cat: string): "공통" | "학사" | "행정" | "연구" | "부속" | "기타" {
  const direct: Record<string, "공통" | "학사" | "행정" | "연구" | "부속" | "기타"> = {
    "공통": "공통",
    "학사": "학사",
    "행정": "행정",
    "연구": "연구",
    "부속": "부속",
    "미정": "기타",
  };
  return direct[cat] ?? "공통";
}
