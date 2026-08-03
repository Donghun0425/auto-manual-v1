import { createHash } from "crypto";
import { supabase } from "@/lib/supabase/client";
import type {
  ManualResultRow,
  ManualResultInsert,
  ManualResult,
  ClxParseResult,
  AiUsage,
  OutputType,
} from "@/types";

/** Increment when parser/enrichment changes alter saved manual semantics. */
const MANUAL_ANALYSIS_VERSION = "4";

// ============================================================
// 해시 · 식별자
// ============================================================

/** 파일 내용으로 source_hash 계산 (sha1) */
export function computeSourceHash(content: string): string {
  return createHash("sha1")
    .update(`${MANUAL_ANALYSIS_VERSION}\0${content}`)
    .digest("hex");
}

/** 경로에서 파일명만 추출 */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// ============================================================
// 직렬화 헬퍼
// ============================================================

/** DB Row → ManualResult (클라이언트 결과 모델) 변환 */
export function rowToManualResult(row: ManualResultRow): ManualResult {
  return {
    fileName: row.file_name,
    filePath: row.file_path || row.file_name,
    parseResult: (row.parse_result ?? {}) as ClxParseResult,
    htmlContent: row.html_content ?? undefined,
    markdownContent: row.markdown_content ?? undefined,
    tokenUsage: (row.token_usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    }) as AiUsage,
    generatedAt: row.generated_at,
  };
}

// ============================================================
// 조회
// ============================================================

/** 단일 ID 로 저장본 조회 (히스토리 불러오기용) */
export async function getManualResultById(
  id: string
): Promise<ManualResultRow | null> {
  const { data, error } = await supabase
    .from("manual_result")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`매뉴얼 결과 조회 실패: ${error.message}`);
  return (data as ManualResultRow | null) ?? null;
}

/** (file_name, source_hash) 로 정확히 일치하는 저장본 조회 (재사용용) */
export async function getManualResultByKey(
  fileName: string,
  sourceHash: string
): Promise<ManualResultRow | null> {
  const { data, error } = await supabase
    .from("manual_result")
    .select("*")
    .eq("file_name", fileName)
    .eq("source_hash", sourceHash)
    .maybeSingle();

  if (error) throw new Error(`매뉴얼 결과 조회 실패: ${error.message}`);
  return (data as ManualResultRow | null) ?? null;
}

/** 여러 파일명의 저장본 메타 조회 (UI 뱃지·존재 여부 표시용) */
export interface ManualResultSummary {
  id: string;
  fileName: string;
  sourceHash: string;
  outputFormats: OutputType[];
  generatedAt: string;
}

export async function findManualResultsByFileNames(
  fileNames: string[]
): Promise<ManualResultSummary[]> {
  if (fileNames.length === 0) return [];

  const { data, error } = await supabase
    .from("manual_result")
    .select("id, file_name, source_hash, output_formats, generated_at")
    .in("file_name", fileNames);

  if (error) throw new Error(`매뉴얼 결과 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => {
    const row = r as Pick<
      ManualResultRow,
      "id" | "file_name" | "source_hash" | "output_formats" | "generated_at"
    >;
    return {
      id: row.id,
      fileName: row.file_name,
      sourceHash: row.source_hash,
      outputFormats: row.output_formats ?? [],
      generatedAt: row.generated_at,
    };
  });
}

/** 최근 생성 저장본 목록 (랜딩 페이지 히스토리용, 파일명당 최신 1건) */
export async function listRecentManualResults(
  limit = 10
): Promise<ManualResultRow[]> {
  const { data, error } = await supabase
    .from("manual_result")
    .select(
      "id, file_name, source_hash, file_path, html_content, markdown_content, token_usage, output_formats, generated_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`매뉴얼 결과 목록 조회 실패: ${error.message}`);
  // parse_result 는 목록에서 제외(용량) → 부분 Row 로 반환
  return (data ?? []) as unknown as ManualResultRow[];
}

/** 전체 저장본 조회 (히스토리 페이지용, parse_result 포함). 파일명 오름차순 */
export async function listAllManualResults(
  limit = 1000
): Promise<ManualResultRow[]> {
  const { data, error } = await supabase
    .from("manual_result")
    .select("*")
    .order("file_name", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`매뉴얼 결과 전체 조회 실패: ${error.message}`);
  return (data ?? []) as ManualResultRow[];
}

// ============================================================
// 저장 · 삭제
// ============================================================

/**
 * 매뉴얼 결과 저장 (새로 생성).
 * 동일 file_name 의 기존 저장본을 모두 삭제한 뒤 새 행을 입력한다.
 * (파일명당 최신 1건만 유지)
 */
export async function upsertManualResult(
  input: ManualResultInsert
): Promise<ManualResultRow> {
  // 1. 동일 파일명 기존 저장본 삭제
  const { error: delError } = await supabase
    .from("manual_result")
    .delete()
    .eq("file_name", input.file_name);

  if (delError) throw new Error(`기존 매뉴얼 결과 삭제 실패: ${delError.message}`);

  // 2. 새 행 입력
  const { data, error } = await supabase
    .from("manual_result")
    .insert(input as unknown as Record<string, unknown>)
    .select()
    .single();

  if (error) throw new Error(`매뉴얼 결과 저장 실패: ${error.message}`);
  return data as ManualResultRow;
}

/** ManualResult + 메타 → DB 저장 (편의 래퍼) */
export async function saveManualResult(params: {
  result: ManualResult;
  sourceHash: string;
  outputFormats: OutputType[];
}): Promise<ManualResultRow> {
  const { result, sourceHash, outputFormats } = params;
  return upsertManualResult({
    file_name: result.fileName,
    source_hash: sourceHash,
    file_path: result.filePath,
    parse_result: result.parseResult as unknown,
    html_content: result.htmlContent ?? null,
    markdown_content: result.markdownContent ?? null,
    token_usage: result.tokenUsage as unknown,
    output_formats: outputFormats,
    generated_at: result.generatedAt,
  });
}

/** 파일명으로 저장본 삭제 */
export async function deleteManualResultByFileName(
  fileName: string
): Promise<void> {
  const { error } = await supabase
    .from("manual_result")
    .delete()
    .eq("file_name", fileName);

  if (error) throw new Error(`매뉴얼 결과 삭제 실패: ${error.message}`);
}
