import { NextRequest, NextResponse } from "next/server";
import { generateManualForFile } from "@/lib/ai/generate";
import { renderManual } from "@/lib/output";
import { insertGenerationLog } from "@/lib/supabase/queries/generation-log";
import type { AiSettings, LayoutSection, ManualResult, GenerationError, OutputType } from "@/types";

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
 * POST /api/generate
 * 선택된 파일들에 대해 매뉴얼 생성 수행
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

  for (const file of files) {
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

      totalTokens += result.tokenUsage.total_tokens;
      results.push(result);

      // 생성 로그 저장 (실패해도 무시)
      for (const fmt of outputFormats) {
        try {
          await insertGenerationLog({
            file_name: result.fileName,
            output_type: fmt,
            token_usage: result.tokenUsage.total_tokens,
          });
        } catch {
          // 로그 저장 실패 무시
        }
      }
    } catch (err) {
      errors.push({
        fileName: file.path.split("/").pop() ?? file.path,
        step: "generation",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      });
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
