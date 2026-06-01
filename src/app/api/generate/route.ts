import { NextRequest, NextResponse } from "next/server";
import { generateManualForFile } from "@/lib/ai/generate";
import { renderManual } from "@/lib/output";
import { insertGenerationLog } from "@/lib/supabase/queries/generation-log";
import {
  computeSourceHash,
  fileNameOf,
  getManualResultByKey,
  rowToManualResult,
  saveManualResult,
} from "@/lib/supabase/queries/manual-result";
import type { AiSettings, LayoutSection, ManualResult, GenerationError, OutputType } from "@/types";

/** 동시 AI 호출 제한 (rate limit 방지) */
const CONCURRENCY_LIMIT = 3;

export interface GenerateRequestBody {
  /** reuse: 해당 파일은 기존 DB 저장본을 재사용 (없으면 자동 새 생성) */
  files: { path: string; content: string; reuse?: boolean }[];
  settings: AiSettings;
  useDictionary: boolean;
  useUdcContext?: boolean;
  outputFormats: OutputType[];
  layoutSections?: LayoutSection[];
}

export interface GenerateResponseBody {
  results: ManualResult[];
  errors: GenerationError[];
  totalTokens: number;
  duration: number;
  /** 재사용(DB 저장본)으로 처리된 파일명 목록 */
  reusedFiles: string[];
}

/**
 * 제한된 동시 실행 수로 비동기 작업을 병렬 처리
 */
async function parallelWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/generate
 * 선택된 파일들에 대해 매뉴얼 생성 수행 (병렬 처리)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  let body: GenerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { files, settings, useDictionary, useUdcContext, outputFormats, layoutSections } = body;

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "파일이 선택되지 않았습니다." }, { status: 400 });
  }

  if (!settings) {
    return NextResponse.json({ error: "AI 설정이 필요합니다." }, { status: 400 });
  }

  const results: ManualResult[] = [];
  const errors: GenerationError[] = [];
  const reusedFiles: string[] = [];
  let totalTokens = 0;

  // 파일 수가 1개면 순차, 2개 이상이면 병렬 처리
  const processFile = async (file: { path: string; content: string; reuse?: boolean }) => {
    const fileName = fileNameOf(file.path);
    const sourceHash = computeSourceHash(file.content);

    try {
      // 1) 재사용 요청 시: DB 저장본 조회 (내용 해시 일치 시에만 재사용)
      if (file.reuse) {
        try {
          const row = await getManualResultByKey(fileName, sourceHash);
          if (row) {
            return {
              type: "success" as const,
              result: rowToManualResult(row),
              reused: true,
            };
          }
        } catch {
          // 조회 실패 시 새 생성으로 폴백
        }
        // 저장본 없으면 자동으로 새 생성 (아래로 진행)
      }

      // 2) 새로 생성
      const result = await generateManualForFile({
        filePath: file.path,
        content: file.content,
        settings,
        useDictionary,
        useUdcContext,
      });

      // HTML/MD 렌더링
      const rendered = renderManual(result.parseResult, {
        sections: layoutSections,
        formats: outputFormats,
      });
      if (rendered.htmlContent) result.htmlContent = rendered.htmlContent;
      if (rendered.markdownContent) result.markdownContent = rendered.markdownContent;

      // 3) 생성 직후 자동 저장 (기존 행 삭제 후 입력). 실패해도 결과는 반환.
      try {
        await saveManualResult({ result, sourceHash, outputFormats });
      } catch {
        // 저장 실패 무시 (DB 미설정 환경 등)
      }

      return { type: "success" as const, result, reused: false };
    } catch (err) {
      return {
        type: "error" as const,
        error: {
          fileName,
          step: "generation" as const,
          message: err instanceof Error ? err.message : "알 수 없는 오류",
          timestamp: new Date().toISOString(),
        },
      };
    }
  };

  const outcomes = await parallelWithLimit(files, CONCURRENCY_LIMIT, processFile);

  for (const outcome of outcomes) {
    if (outcome.type === "success") {
      results.push(outcome.result);
      totalTokens += outcome.result.tokenUsage.total_tokens;
      if (outcome.reused) reusedFiles.push(outcome.result.fileName);
    } else {
      errors.push(outcome.error);
    }
  }

  // 생성 로그 저장 (비동기, 실패 무시). 재사용 항목은 로그 제외.
  for (const r of results) {
    if (reusedFiles.includes(r.fileName)) continue;
    for (const fmt of outputFormats) {
      insertGenerationLog({
        file_name: r.fileName,
        output_type: fmt,
        token_usage: r.tokenUsage.total_tokens,
      }).catch(() => {});
    }
  }

  const duration = Date.now() - startTime;

  const responseBody: GenerateResponseBody = {
    results,
    errors,
    totalTokens,
    duration,
    reusedFiles,
  };

  return NextResponse.json(responseBody);
}
