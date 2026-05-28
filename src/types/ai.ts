/**
 * AI 연동 요청/응답 인터페이스 정의
 * GitHub Models API 및 VS Code Extension Proxy
 */

/** AI 제공자 모드 */
export type AiProvider = "github" | "vscode-proxy" | "internal";

/** AI 모델 옵션 */
export type AiModel =
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "gemma4-31b";

/** AI 설정 (localStorage 저장) */
export interface AiSettings {
  provider: AiProvider;
  apiKey?: string;
  model: AiModel;
  proxyUrl: string;
  internalBaseUrl: string;
  maxTokens: number;
  temperature: number;
}

/** AI 기본 설정 */
export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "vscode-proxy",
  model: "gpt-4o-mini",
  proxyUrl: "http://localhost:3100",
  internalBaseUrl: "http://192.168.71.125/v1",
  maxTokens: 4096,
  temperature: 0.3,
};

/** AI 요청 메시지 */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** AI 요청 페이로드 (GitHub Models API 호환) */
export interface AiRequest {
  model: string;
  messages: AiMessage[];
  max_tokens?: number;
  temperature?: number;
}

/** AI 응답 (GitHub Models API 호환) */
export interface AiResponse {
  id: string;
  choices: AiChoice[];
  usage: AiUsage;
}

/** AI 응답 선택지 */
export interface AiChoice {
  index: number;
  message: AiMessage;
  finish_reason: string;
}

/** AI 토큰 사용량 */
export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** 매뉴얼 생성 AI 요청 컨텍스트 */
export interface ManualGenerationContext {
  category: string;
  fieldName: string;
  controlType?: string;
  screenContext?: string;
}

/** AI 생성 결과 */
export interface AiGenerationResult {
  term: string;
  description: string;
  usage: AiUsage;
  fromDictionary: boolean;
}
