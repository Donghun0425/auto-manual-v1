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
  // 내부 AI 서버(Dify)는 별도 호출 로직 사용
  if (settings.provider === "internal") {
    return callDifyAi(settings, messages);
  }

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

      // 프록시가 HTTP 200으로 에러 JSON을 반환하는 경우 감지
      if (raw?.error) {
        const errMsg =
          typeof raw.error === "string"
            ? raw.error
            : (raw.error?.message ?? JSON.stringify(raw.error));
        throw new Error(`프록시 오류: ${errMsg}`);
      }

      // choices 가 없는 경우 (지원하지 않는 모델 등)
      if (!Array.isArray(raw?.choices) || raw.choices.length === 0) {
        throw new Error(
          `AI 응답에 choices가 없습니다. 요청 모델: ${settings.model}`
        );
      }

      const normalizedUsage = normalizeUsage(raw?.usage);
      const responseContent: string =
        raw.choices[0]?.message?.content ?? "";
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

/**
 * 내부 AI 서버(Dify) 호출.
 * Dify /v1/chat-messages 엔드포인트를 사용하고, 응답을 AiResponse 형식으로 변환한다.
 * messages 배열의 system/user 메시지를 query 문자열로 병합하여 전달한다.
 */
async function callDifyAi(
  settings: AiSettings,
  messages: AiMessage[]
): Promise<AiResponse> {
  const apiKey = process.env.INTERNAL_AI_KEY;
  if (!apiKey) {
    throw new Error("내부 AI 서버 API 키가 설정되지 않았습니다. 서버 환경변수 INTERNAL_AI_KEY를 설정하세요.");
  }

  const baseUrl = (settings.internalBaseUrl ?? "http://192.168.71.125/v1").replace(/\/$/, "");
  const url = `${baseUrl}/chat-messages`;

  // system 메시지를 지시사항으로, user 메시지를 query로 병합
  const systemParts: string[] = [];
  const userParts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else if (msg.role === "user") {
      userParts.push(msg.content);
    }
  }
  const query = systemParts.length > 0
    ? `[지시사항]\n${systemParts.join("\n")}\n\n[요청]\n${userParts.join("\n")}`
    : userParts.join("\n");

  const difyPayload = {
    inputs: {},
    query,
    response_mode: "blocking",
    user: "auto-manual-generator",
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(difyPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
          lastError = new Error(
            `내부 AI 서버 요청 실패 (${response.status}): ${errorBody || response.statusText}`
          );
          await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
          continue;
        }
        throw new Error(
          `내부 AI 서버 요청 실패 (${response.status}): ${errorBody || response.statusText}`
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await response.json();

      // Dify 에러 응답 감지
      if (raw?.code && raw?.message) {
        throw new Error(`내부 AI 서버 오류: ${raw.message}`);
      }

      const answer: string = raw?.answer ?? "";
      if (!answer) {
        throw new Error("내부 AI 서버 응답에 answer가 없습니다.");
      }

      // Dify 응답을 AiResponse 형식으로 변환
      const difyUsage = raw?.metadata?.usage;
      const usage = normalizeUsage(difyUsage);
      const finalUsage = fillEstimatedUsage(usage, messages, answer);

      const data: AiResponse = {
        id: raw?.message_id ?? raw?.id ?? "",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: answer },
            finish_reason: "stop",
          },
        ],
        usage: finalUsage,
      };
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error("내부 AI 서버 호출 실패");
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
