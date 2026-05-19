/**
 * 매뉴얼 생성 옵션 및 결과 타입 정의
 */

import type { ClxParseResult } from "./clx";
import type { AiModel, AiProvider, AiUsage } from "./ai";
import type { OutputType } from "./database";

/** 매뉴얼 생성 옵션 */
export interface GenerationOptions {
  provider: AiProvider;
  model: AiModel;
  outputFormats: OutputType[];
  layoutTemplateId?: string;
  useDictionary: boolean;
}

/** 매뉴얼 생성 진행 상태 */
export type GenerationStatus =
  | "idle"
  | "parsing"
  | "generating"
  | "completed"
  | "error";

/** 매뉴얼 생성 진행률 */
export interface GenerationProgress {
  status: GenerationStatus;
  currentFile?: string;
  currentStep?: string;
  processedFiles: number;
  totalFiles: number;
  totalTokens: number;
  errors: GenerationError[];
}

/** 생성 중 발생한 에러 */
export interface GenerationError {
  fileName: string;
  step: string;
  message: string;
  timestamp: string;
}

/** 단일 파일 매뉴얼 생성 결과 */
export interface ManualResult {
  fileName: string;
  filePath: string;
  parseResult: ClxParseResult;
  htmlContent?: string;
  markdownContent?: string;
  tokenUsage: AiUsage;
  generatedAt: string;
}

/** 전체 생성 결과 */
export interface GenerationResult {
  results: ManualResult[];
  totalTokenUsage: AiUsage;
  generatedAt: string;
  duration: number;
}
