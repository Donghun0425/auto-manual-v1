import { NextRequest, NextResponse } from "next/server";
import { generateManualForFile } from "@/lib/ai/generate";
import { renderManual } from "@/lib/output";
import { insertGenerationLog } from "@/lib/supabase/queries/generation-log";
import type { AiSettings, LayoutSection, ManualResult, GenerationError, OutputType } from "@/types";

/** 동시 AI 호출 제한 (rate limit 방지) */
const CONCURRENCY_LIMIT = 3;

export interface GenerateRequestBody {
  files: { path: string; content: string }[];
  settings: AiSettings;
  useDictionary: boolean;
  outputFormats: OutputType[];
  layoutSections?: LayoutSection[];
}

export interface GenerateResponseBody {
  results: ManualResult[];
  errors: GenerationError[];
  totalTokens: number;
  duration: number;
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

  const { files, settings, useDictionary, outputFormats, layoutSections } = body;

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "파일이 선택되지 않았습니다." }, { status: 400 });
  }

  if (!settings) {
    return NextResponse.json({ error: "AI 설정이 필요합니다." }, { status: 400 });
  }

  const results: ManualResult[] = [];
  const errors: GenerationError[] = [];
  let totalTokens = 0;

  // 파일 수가 1개면 순차, 2개 이상이면 병렬 처리
  const processFile = async (file: { path: string; content: string }) => {
    try {
      const result = await generateManualForFile({
        filePath: file.path,
        content: file.content,
        settings,
        useDictionary,
      });

      // HTML/MD 렌더링
      const rendered = renderManual(result.parseResult, {
        sections: layoutSections,
        formats: outputFormats,
      });
      if (rendered.htmlContent) result.htmlContent = rendered.htmlContent;
      if (rendered.markdownContent) result.markdownContent = rendered.markdownContent;

      return { type: "success" as const, result };
    } catch (err) {
      return {
        type: "error" as const,
        error: {
          fileName: file.path.split("/").pop() ?? file.path,
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
    } else {
      errors.push(outcome.error);
    }
  }

  // 생성 로그 저장 (비동기, 실패 무시)
  for (const r of results) {
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
  };

  return NextResponse.json(responseBody);
}
