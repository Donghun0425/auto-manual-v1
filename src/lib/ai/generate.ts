/**
 * 매뉴얼 생성 오케스트레이터
 * 파싱 → AI 설명 생성 → 결과 조합
 */
import type {
  AiSettings,
  AiUsage,
  ClxParseResult,
  GridColumnInfo,
  ConditionControlInfo,
  ManualResult,
  DictionaryContextType,
} from "@/types";
import { analyzeFile } from "@/lib/parser";
import { callAi, extractContent } from "./client";
import {
  buildGridColumnPrompt,
  buildConditionControlPrompt,
  buildButtonDescriptionPrompt,
  buildOverviewPrompt,
  buildUsagePrompt,
  buildNotesPrompt,
} from "./prompts";
import { findDictionaryByTerms, upsertDictionary } from "@/lib/supabase/queries/dictionary";

export interface GenerateFileOptions {
  filePath: string;
  content: string;
  settings: AiSettings;
  useDictionary: boolean;
  onProgress?: (step: string) => void;
}

/** 배치 AI 호출 시 최대 컬럼/컨트롤 수 (초과 시 분할) */
const BATCH_CHUNK_SIZE = 15;

/** AI 응답에서 마크다운 코드블록(```json ... ```) 래핑을 제거 */
function stripCodeBlock(text: string): string {
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/.exec(text.trim());
  return m ? m[1].trim() : text.trim();
}

/**
 * 파일명 앞글자로 카테고리 판별
 * c* → 공통, u* → 학사, a* → 행정, 그 외 → 기타 (대소문자 무시)
 */
function getCategoryFromFileName(filePath: string): "공통" | "학사" | "행정" | "기타" {
  const fileName = filePath.split("/").pop() ?? filePath;
  const firstChar = fileName.charAt(0).toLowerCase();
  if (firstChar === "c") return "공통";
  if (firstChar === "u") return "학사";
  if (firstChar === "a") return "행정";
  return "기타";
}

/**
 * 단일 파일에 대한 매뉴얼 생성
 */
export async function generateManualForFile(
  options: GenerateFileOptions
): Promise<ManualResult> {
  const { filePath, content, settings, useDictionary, onProgress } = options;
  let totalUsage: AiUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // 1. 파싱
  onProgress?.("파싱 중...");
  const parseResult = analyzeFile(filePath, content);

  // 2~5. AI enrichment (실패해도 파싱 결과는 유지)
  try {
    // 2. 그리드 컬럼 설명 AI 생성
    onProgress?.("그리드 설명 생성 중...");
    totalUsage = await enrichGridDescriptions(parseResult, settings, useDictionary, totalUsage, filePath);

    // 3. 조건그룹 컨트롤 설명 AI 생성
    onProgress?.("조건그룹 설명 생성 중...");
    totalUsage = await enrichConditionDescriptions(parseResult, settings, useDictionary, totalUsage, filePath);

    // 4. 버튼 설명 AI 생성
    onProgress?.("버튼 설명 생성 중...");
    totalUsage = await enrichButtonDescriptions(parseResult, settings, totalUsage);

    // 5. 화면 개요 설명 생성
    onProgress?.("화면 개요 생성 중...");
    totalUsage = await enrichOverview(parseResult, settings, totalUsage);

    // 6. 사용방법 Step별 설명 생성
    onProgress?.("사용방법 생성 중...");
    totalUsage = await enrichUsageText(parseResult, settings, totalUsage);

    // 7. 참고사항 변환 생성
    onProgress?.("참고사항 변환 중...");
    totalUsage = await enrichNotes(parseResult, settings, totalUsage);
  } catch {
    // AI enrichment 실패해도 파싱 결과는 반환
    onProgress?.("AI 연동 실패 — 파싱 결과만 반환");
  }

  return {
    fileName: filePath.split("/").pop() ?? filePath,
    filePath,
    parseResult,
    tokenUsage: totalUsage,
    generatedAt: new Date().toISOString(),
  };
}

/** 그리드 컬럼 설명 보강 */
async function enrichGridDescriptions(
  parseResult: ClxParseResult,
  settings: AiSettings,
  useDictionary: boolean,
  usage: AiUsage,
  filePath: string
): Promise<AiUsage> {
  const category = getCategoryFromFileName(filePath);
  const contextType: DictionaryContextType = "그리드";

  for (const grid of parseResult.items.grids) {
    if (grid.skipAiDescriptions) continue;

    // 설명이 비어있는 컬럼만 대상
    const needDesc = grid.columns.filter((c) => !c.description);
    if (needDesc.length === 0) continue;

    // 사전 우선 조회 (사전 연동 모드일 때만) — IN 절 1회 일괄 조회
    let toProcess = needDesc;
    if (useDictionary) {
      const terms = needDesc.map((c) => c.headerText);
      const dictMap = await findDictionaryByTerms(terms, contextType);
      toProcess = needDesc.filter((col) => {
        const found = dictMap.get(col.headerText.trim());
        if (found) { col.description = found; return false; }
        return true;
      });
    }

    if (toProcess.length === 0) continue;

    // 청크 단위로 batch AI 호출
    for (let i = 0; i < toProcess.length; i += BATCH_CHUNK_SIZE) {
      const chunk = toProcess.slice(i, i + BATCH_CHUNK_SIZE);
      const batchUsage = await batchGridColumnAi(parseResult, grid, chunk, settings);
      usage = addUsage(usage, batchUsage);
    }

    // AI 생성 결과를 단어사전에 저장 — context_type='grid' (사전 연동 모드일 때만)
    if (useDictionary) {
      for (const col of toProcess) {
        if (col.description) {
          upsertDictionary({ term: col.headerText, context_type: contextType, category, description: col.description, source: "ai" }).catch(() => {});
        }
      }
    }
  }
  return usage;
}

/** 그리드 컬럼 일괄 AI 호출 */
async function batchGridColumnAi(
  parseResult: ClxParseResult,
  grid: { gridId: string; title: string },
  columns: GridColumnInfo[],
  settings: AiSettings
): Promise<AiUsage> {
  if (columns.length === 0) return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const messages = buildGridColumnPrompt(parseResult, grid, columns);
  const response = await callAi(settings, messages);
  const raw = extractContent(response);
  const text = stripCodeBlock(raw);

  try {
    const parsed = JSON.parse(text) as { columnName: string; description: string }[];
    for (const item of parsed) {
      // 1차: headerText(항목명) 매칭 (프롬프트에서 항목명 기반 응답 요청)
      let col = columns.find((c) => c.headerText === item.columnName);
      // 2차: columnName(ID) 매칭 (fallback)
      if (!col) col = columns.find((c) => c.columnName === item.columnName);
      if (col && item.description) col.description = item.description;
    }
  } catch {
    // JSON 파싱 실패 시 원문을 첫 번째 컬럼에 할당
    if (columns.length === 1 && text) {
      columns[0].description = text;
    }
  }

  return response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
}

/** groupType → DictionaryContextType 매핑 */
function groupTypeToContextType(groupType: string): DictionaryContextType {
  if (groupType === "조회조건") return "조회조건";
  if (groupType === "처리조건" || groupType === "일괄처리") return "처리조건";
  return "인포영역";
}

/** 조건그룹 컨트롤 설명 보강 */
async function enrichConditionDescriptions(
  parseResult: ClxParseResult,
  settings: AiSettings,
  useDictionary: boolean,
  usage: AiUsage,
  filePath: string
): Promise<AiUsage> {
  const category = getCategoryFromFileName(filePath);
  const allGroups = [
    ...parseResult.items.conditionGroups,
    ...parseResult.items.infoGroups.map((g) => ({ ...g, groupType: "세부정보" as const })),
  ];

  for (const group of allGroups) {
    const contextType = groupTypeToContextType(group.groupType);
    const needDesc = group.controls.filter((c) => !c.description);
    if (needDesc.length === 0) continue;

    // 사전 우선 조회 — IN 절 1회 일괄 조회
    let toProcess = needDesc;
    if (useDictionary) {
      const terms = needDesc.map((c) => c.labelText);
      const dictMap = await findDictionaryByTerms(terms, contextType);
      toProcess = needDesc.filter((ctrl) => {
        const found = dictMap.get(ctrl.labelText.trim());
        if (found) { ctrl.description = found; return false; }
        return true;
      });
    }

    if (toProcess.length === 0) continue;

    // 청크 단위로 batch AI 호출
    for (let i = 0; i < toProcess.length; i += BATCH_CHUNK_SIZE) {
      const chunk = toProcess.slice(i, i + BATCH_CHUNK_SIZE);
      const batchUsage = await batchConditionAi(parseResult, group.groupType, chunk, settings);
      usage = addUsage(usage, batchUsage);
    }

    // AI 생성 결과를 단어사전에 저장 — context_type 별 독립 (사전 연동 모드일 때만)
    if (useDictionary) {
      for (const ctrl of toProcess) {
        if (ctrl.description) {
          upsertDictionary({ term: ctrl.labelText, context_type: contextType, category, description: ctrl.description, source: "ai" }).catch(() => {});
        }
      }
    }
  }
  return usage;
}

/** 조건그룹 일괄 AI 호출 */
async function batchConditionAi(
  parseResult: ClxParseResult,
  groupType: string,
  controls: ConditionControlInfo[],
  settings: AiSettings
): Promise<AiUsage> {
  if (controls.length === 0) return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const messages = buildConditionControlPrompt(parseResult, groupType, controls);
  const response = await callAi(settings, messages);
  const raw = extractContent(response);
  const text = stripCodeBlock(raw);

  try {
    const parsed = JSON.parse(text) as { controlId: string; description: string }[];
    for (const item of parsed) {
      // 1차: controlId 매칭
      let ctrl = controls.find((c) => c.controlId === item.controlId);
      // 2차: labelText 매칭 (AI가 labelText를 반환하는 경우)
      if (!ctrl) ctrl = controls.find((c) => c.labelText === item.controlId);
      if (ctrl && item.description) ctrl.description = item.description;
    }
  } catch {
    if (controls.length === 1 && text) {
      controls[0].description = text;
    }
  }

  return response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
}

/** 버튼 설명 보강 */
async function enrichButtonDescriptions(
  parseResult: ClxParseResult,
  settings: AiSettings,
  usage: AiUsage
): Promise<AiUsage> {
  const allButtons = [
    ...parseResult.usage.menuTitleBar.extButtons,
    ...parseResult.usage.titleBars.flatMap((tb) => tb.extButtons),
    ...parseResult.usage.extraButtons,
  ];

  const needDesc = allButtons.filter((b) => !b.description);
  if (needDesc.length === 0) return usage;

  const messages = buildButtonDescriptionPrompt(
    parseResult,
    needDesc.map((b) => ({ name: b.name, functionName: b.functionName }))
  );
  const response = await callAi(settings, messages);
  const raw = extractContent(response);
  const text = stripCodeBlock(raw);

  try {
    const parsed = JSON.parse(text) as { name: string; description: string }[];
    for (const item of parsed) {
      const btn = needDesc.find((b) => b.name === item.name);
      if (btn && item.description) btn.description = item.description;
    }
  } catch {
    if (needDesc.length === 1 && text) {
      needDesc[0].description = text;
    }
  }

  return addUsage(usage, response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}

/** 화면 개요 보강 — 항상 AI가 생성하여 덮어씀 */
async function enrichOverview(
  parseResult: ClxParseResult,
  settings: AiSettings,
  usage: AiUsage
): Promise<AiUsage> {
  const messages = buildOverviewPrompt(parseResult);
  const response = await callAi(settings, messages);
  const text = extractContent(response);

  if (text) {
    parseResult.overview.description = text;
  }

  return addUsage(usage, response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}

/** 토큰 사용량 합산 */
function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    prompt_tokens: a.prompt_tokens + b.prompt_tokens,
    completion_tokens: a.completion_tokens + b.completion_tokens,
    total_tokens: a.total_tokens + b.total_tokens,
  };
}

/** 사용방법 Step별 텍스트 생성 ({B}기능명{/B} + Step 형식) */
async function enrichUsageText(
  parseResult: ClxParseResult,
  settings: AiSettings,
  usage: AiUsage
): Promise<AiUsage> {
  // 기능이 없으면 스킵
  const menu = parseResult.usage.menuTitleBar;
  const hasFeatures = menu.hasInquiry || menu.hasNew || menu.hasSave || menu.hasDelete || menu.extButtons.length > 0;
  if (!hasFeatures && parseResult.usage.titleBars.length === 0) return usage;

  const messages = buildUsagePrompt(parseResult);
  const response = await callAi(settings, messages);
  let text = extractContent(response);

  if (text) {
    // 후처리 1: 소제목에 남은 '기능' 단어 제거
    text = text.replace(/\{B\}([^{]+?)\s+기능\s*\{\/B\}/g, "{B}$1{/B}");

    // 후처리 2: 파서 CRUD 플래그와 불일치하는 AI 생성 섹션 제거
    const forbiddenSections: string[] = [];
    for (const tb of parseResult.usage.titleBars) {
      const label = (tb.title || "상세 정보").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!tb.hasNew) forbiddenSections.push(`\\{B\\}${label}\\s*[-–]\\s*신규\\{/B\\}`);
      if (!tb.hasSave) forbiddenSections.push(`\\{B\\}${label}\\s*[-–]\\s*저장\\{/B\\}`);
      if (!tb.hasDelete) forbiddenSections.push(`\\{B\\}${label}\\s*[-–]\\s*삭제\\{/B\\}`);
    }
    if (forbiddenSections.length > 0) {
      for (const pattern of forbiddenSections) {
        text = text.replace(
          new RegExp(`${pattern}\\n(?:Step\\d+\\.[^\\n]*\\n?)*`, "g"),
          ""
        );
      }
    }

    parseResult.aiUsageText = text;
  }

  return addUsage(usage, response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}

/** 참고사항 변환: 시스템 메시지 → 사용자 친화적 안내문 */
async function enrichNotes(
  parseResult: ClxParseResult,
  settings: AiSettings,
  usage: AiUsage
): Promise<AiUsage> {
  // 검증 메시지 중 조회/저장/삭제 전용이 아닌 기타 주의사항만 대상
  const COMPLETION_RE = /^(?:처리|저장|삭제|등록|수정|복사|생성|변경|갱신|적용|실행)[^\n]*?(?:되었습니다|했습니다|하였습니다)[.!]?\s*$/;
  const otherVals = parseResult.notes.validations
    .filter(v => !/inq|inquiry|search|save|del/i.test(v.functionName))
    .filter(v => !COMPLETION_RE.test(v.message.trim()));

  if (otherVals.length === 0) return usage;

  // 함수명 → 버튼명 맵 구성
  const funcLabelMap = new Map<string, string>();
  for (const btn of parseResult.usage.extraButtons) {
    funcLabelMap.set(btn.functionName, btn.name);
  }
  for (const tb of parseResult.usage.titleBars) {
    const tbLabel = tb.title || "상세 정보";
    for (const btn of tb.extButtons) {
      funcLabelMap.set(btn.functionName, `${tbLabel} - ${btn.name}`);
    }
  }

  // 그룹화: label → messages[]
  const groups = new Map<string, string[]>();
  for (const v of otherVals) {
    const btnLabel = funcLabelMap.get(v.functionName);
    const label = btnLabel ? `${btnLabel} 실행 전 확인사항` : "기타 주의사항";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(v.message);
  }

  const warnings = Array.from(groups.entries()).map(([label, messages]) => ({ label, messages }));
  const messages = buildNotesPrompt(parseResult.overview.programName, warnings);
  const response = await callAi(settings, messages);
  const text = extractContent(response);

  if (text) {
    // "번호. 설명" 형식 파싱 → 그룹별 매핑 복원
    let totalMessages = 0;
    const indexMap: { label: string; count: number; startIdx: number }[] = [];
    for (const w of warnings) {
      indexMap.push({ label: w.label, count: w.messages.length, startIdx: totalMessages });
      totalMessages += w.messages.length;
    }

    const allDescriptions: string[] = new Array(totalMessages).fill("");
    for (const line of text.split("\n")) {
      const m = /^(\d+)\.\s*(.+)$/.exec(line.trim());
      if (m) {
        const idx = parseInt(m[1]) - 1;
        if (idx >= 0 && idx < totalMessages) {
          allDescriptions[idx] = m[2].trim();
        }
      }
    }

    const result = new Map<string, string[]>();
    for (const { label, count, startIdx } of indexMap) {
      const descs = allDescriptions.slice(startIdx, startIdx + count).map((d, i) => {
        const originalGroup = warnings.find(w => w.label === label);
        return d || originalGroup?.messages[i] || "";
      });
      result.set(label, descs);
    }
    parseResult.aiNotesDescriptions = result;
  }

  return addUsage(usage, response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}
