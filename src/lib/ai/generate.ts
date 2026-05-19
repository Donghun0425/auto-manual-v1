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
} from "@/types";
import { analyzeFile } from "@/lib/parser";
import { callAi, extractContent } from "./client";
import {
  buildGridColumnPrompt,
  buildConditionControlPrompt,
  buildButtonDescriptionPrompt,
  buildOverviewPrompt,
} from "./prompts";
import { getDescriptionWithDictionary } from "./dictionary-ai";

export interface GenerateFileOptions {
  filePath: string;
  content: string;
  settings: AiSettings;
  useDictionary: boolean;
  onProgress?: (step: string) => void;
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
    totalUsage = await enrichGridDescriptions(parseResult, settings, useDictionary, totalUsage);

    // 3. 조건그룹 컨트롤 설명 AI 생성
    onProgress?.("조건그룹 설명 생성 중...");
    totalUsage = await enrichConditionDescriptions(parseResult, settings, useDictionary, totalUsage);

    // 4. 버튼 설명 AI 생성
    onProgress?.("버튼 설명 생성 중...");
    totalUsage = await enrichButtonDescriptions(parseResult, settings, totalUsage);

    // 5. 화면 개요 설명 생성
    onProgress?.("화면 개요 생성 중...");
    totalUsage = await enrichOverview(parseResult, settings, totalUsage);
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
  usage: AiUsage
): Promise<AiUsage> {
  for (const grid of parseResult.items.grids) {
    if (grid.skipAiDescriptions) continue;

    // 설명이 비어있는 컬럼만 대상
    const needDesc = grid.columns.filter((c) => !c.description);
    if (needDesc.length === 0) continue;

    if (useDictionary) {
      // 사전 우선 조회: headerText로 검색
      const remaining: GridColumnInfo[] = [];
      for (const col of needDesc) {
        const result = await getDescriptionWithDictionary(
          col.headerText,
          "grid",
          buildGridColumnPrompt(parseResult, grid, [col]),
          settings,
          { skipInsert: true }
        );
        if (result.fromDictionary) {
          col.description = result.description;
        } else {
          remaining.push(col);
        }
        usage = addUsage(usage, result.usage);
      }
      // 나머지를 일괄 AI 호출
      if (remaining.length > 0) {
        const batchUsage = await batchGridColumnAi(parseResult, grid, remaining, settings);
        usage = addUsage(usage, batchUsage);
      }
    } else {
      // 사전 미사용: 일괄 AI 호출
      const batchUsage = await batchGridColumnAi(parseResult, grid, needDesc, settings);
      usage = addUsage(usage, batchUsage);
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
  const text = extractContent(response);

  try {
    const parsed = JSON.parse(text) as { columnName: string; description: string }[];
    for (const item of parsed) {
      const col = columns.find((c) => c.columnName === item.columnName);
      if (col) col.description = item.description;
    }
  } catch {
    // JSON 파싱 실패 시 원문을 첫 번째 컬럼에 할당
    if (columns.length === 1 && text) {
      columns[0].description = text;
    }
  }

  return response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
}

/** 조건그룹 컨트롤 설명 보강 */
async function enrichConditionDescriptions(
  parseResult: ClxParseResult,
  settings: AiSettings,
  useDictionary: boolean,
  usage: AiUsage
): Promise<AiUsage> {
  const allGroups = [
    ...parseResult.items.conditionGroups,
    ...parseResult.items.infoGroups.map((g) => ({ ...g, groupType: "세부정보" as const })),
  ];

  for (const group of allGroups) {
    const needDesc = group.controls.filter((c) => !c.description);
    if (needDesc.length === 0) continue;

    if (useDictionary) {
      const remaining: ConditionControlInfo[] = [];
      for (const ctrl of needDesc) {
        const result = await getDescriptionWithDictionary(
          ctrl.labelText,
          "condition",
          buildConditionControlPrompt(parseResult, group.groupType, [ctrl]),
          settings,
          { skipInsert: true }
        );
        if (result.fromDictionary) {
          ctrl.description = result.description;
        } else {
          remaining.push(ctrl);
        }
        usage = addUsage(usage, result.usage);
      }
      if (remaining.length > 0) {
        const batchUsage = await batchConditionAi(parseResult, group.groupType, remaining, settings);
        usage = addUsage(usage, batchUsage);
      }
    } else {
      const batchUsage = await batchConditionAi(parseResult, group.groupType, needDesc, settings);
      usage = addUsage(usage, batchUsage);
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
  const text = extractContent(response);

  try {
    const parsed = JSON.parse(text) as { controlId: string; description: string }[];
    for (const item of parsed) {
      const ctrl = controls.find((c) => c.controlId === item.controlId);
      if (ctrl) ctrl.description = item.description;
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
  const text = extractContent(response);

  try {
    const parsed = JSON.parse(text) as { name: string; description: string }[];
    for (const item of parsed) {
      const btn = needDesc.find((b) => b.name === item.name);
      if (btn) btn.description = item.description;
    }
  } catch {
    if (needDesc.length === 1 && text) {
      needDesc[0].description = text;
    }
  }

  return addUsage(usage, response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}

/** 화면 개요 보강 */
async function enrichOverview(
  parseResult: ClxParseResult,
  settings: AiSettings,
  usage: AiUsage
): Promise<AiUsage> {
  if (parseResult.overview.description) return usage;

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
