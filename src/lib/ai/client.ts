/**
 * AI API 클라이언트
 * GitHub Models API 및 VS Code Extension 프록시 지원
 */
import type { AiSettings, AiRequest, AiResponse, AiMessage } from "@/types";

/** GitHub Models API 엔드포인트 */
const GITHUB_MODELS_URL = "https://models.github.ai/inference/chat/completions";

/**
 * AI 설정에 따라 적절한 엔드포인트로 요청을 보낸다.
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

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `AI API 요청 실패 (${response.status}): ${errorBody || response.statusText}`
    );
  }

  const data: AiResponse = await response.json();
  return data;
}

/**
 * AI 응답에서 텍스트 추출
 */
export function extractContent(response: AiResponse): string {
  return response.choices?.[0]?.message?.content?.trim() ?? "";
}
