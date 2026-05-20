/**
 * AI API 클라이언트
 * GitHub Models API 및 VS Code Extension 프록시 지원
 * - 재시도 로직 (exponential backoff)
 * - Rate limit / 5xx 에러 자동 재시도
 */
import type { AiSettings, AiRequest, AiResponse, AiMessage, AiUsage } from "@/types";

/** GitHub Models API 엔드포인트 */
const GITHUB_MODELS_URL = "https://models.github.ai/inference/chat/completions";

/** 재시도 설정 */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * 프록시 종류마다 다른 usage 필드명을 OpenAI 형식으로 정규화.
 * 지원 필드: prompt_tokens / input_tokens / inputTokens
 *            completion_tokens / output_tokens / outputTokens
 *            total_tokens / totalTokens
 */
function normalizeUsage(raw: unknown): AiUsage {
  if (!raw || typeof raw !== "object") {
    return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }
  const u = raw as Record<string, unknown>;
  const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? u.inputTokens ?? 0);
  const completion = Number(
    u.completion_tokens ?? u.output_tokens ?? u.outputTokens ?? 0
  );
  const total = Number(u.total_tokens ?? u.totalTokens ?? prompt + completion);
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}

/**
 * 문자열의 토큰 수를 추정한다.
 * GPT 계열 기준: 영문 ~4자/token, 한글·CJK ~1.5자/token.
 * 두 비율을 혼합해 계산한다.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjkCount = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // 한글, CJK 통합한자, 히라가나/가타카나 범위
    if (
      (cp >= 0xac00 && cp <= 0xd7a3) ||  // 한글
      (cp >= 0x4e00 && cp <= 0x9fff) ||  // CJK
      (cp >= 0x3040 && cp <= 0x30ff)     // 히라가나·가타카나
    ) {
      cjkCount++;
    }
  }
  const latinCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + latinCount / 4);
}

/**
 * usage 의 모든 값이 0이면 메시지/응답 텍스트 기반으로 추정값을 채운다.
 * VS Code Extension 프록시는 usage 를 전부 0으로 반환하므로 이 보정이 필요하다.
 */
function fillEstimatedUsage(
  usage: AiUsage,
  messages: AiMessage[],
  responseContent: string
): AiUsage {
  if (usage.total_tokens > 0) return usage; // 실제 값이 있으면 그대로 사용

  const inputText = messages.map((m) => m.content).join("\n");
  const prompt_tokens = estimateTokens(inputText);
  const completion_tokens = estimateTokens(responseContent);
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
  };
}

/**
 * AI 설정에 따라 적절한 엔드포인트로 요청을 보낸다.
 * 429/5xx 에러 시 exponential backoff 재시도 (최대 3회)
 */
export async function callAi(
  settings: AiSettings,
  messages: AiMessage[]
): Promise<AiResponse> {
  const payload: AiRequest = {
    model: settings.model,
    messages,
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
  };

  const url =
    settings.provider === "github"
      ? GITHUB_MODELS_URL
      : `${settings.proxyUrl.replace(/\/$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.provider === "github") {
    if (!settings.apiKey) {
      throw new Error("GitHub Models API 키가 설정되지 않았습니다.");
    }
    headers["Authorization"] = `Bearer ${settings.apiKey}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        // 재시도 가능한 상태 코드이고 아직 재시도 횟수가 남았으면 재시도
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
          lastError = new Error(
            `AI API 요청 실패 (${response.status}): ${errorBody || response.statusText}`
          );
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
        throw new Error(
          `AI API 요청 실패 (${response.status}): ${errorBody || response.statusText}`
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await response.json();
      const normalizedUsage = normalizeUsage(raw?.usage);
      const responseContent: string =
        raw?.choices?.[0]?.message?.content ?? "";
      const data: AiResponse = {
        ...raw,
        usage: fillEstimatedUsage(normalizedUsage, messages, responseContent),
      };
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // 네트워크 에러 등도 재시도
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error("AI API 호출 실패");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AI 응답에서 텍스트 추출
 */
export function extractContent(response: AiResponse): string {
  return response.choices?.[0]?.message?.content?.trim() ?? "";
}
