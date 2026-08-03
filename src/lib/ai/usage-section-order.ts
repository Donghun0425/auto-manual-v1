import type { ClxParseResult } from "@/types";
import { normalizeFrameworkButtonLabel } from "../button-label.ts";
import { normalizeMessage } from "../utils.ts";

interface UsageSection {
  title: string;
  lines: string[];
  originalIndex: number;
}

function normalizeTitle(title: string): string {
  const normalized = normalizeMessage(title)
    .replace(/\s*[-–]\s*/g, " - ")
    .replace(/\s+/g, " ");
  const separatorIndex = normalized.lastIndexOf(" - ");
  if (separatorIndex < 0) return normalizeFrameworkButtonLabel(normalized);

  const prefix = normalized.slice(0, separatorIndex);
  const suffix = normalized.slice(separatorIndex + 3);
  return `${prefix} - ${normalizeFrameworkButtonLabel(suffix)}`;
}

interface CanonicalUsageSection {
  title?: string;
  lines: string[];
  usesCanonicalTitle: boolean;
}

/**
 * 기술적 프레임워크 제목을 사용자용 제목으로 바꾸고 별칭 중복을 제거한다.
 * 기술적 제목과 정규 제목이 모두 있으면 AI가 작성한 정규 제목 섹션을 우선한다.
 */
export function canonicalizeUsageSections(usageText: string): string {
  const sections: CanonicalUsageSection[] = [];
  let current: CanonicalUsageSection = { lines: [], usesCanonicalTitle: true };

  for (const line of usageText.split("\n")) {
    const heading = /^\s*\{B\}(.+?)\{\/B\}\s*$/.exec(line);
    if (!heading) {
      current.lines.push(line);
      continue;
    }

    if (current.lines.length > 0) sections.push(current);
    const rawTitle = heading[1].trim().replace(/\s*[-–]\s*/g, " - ").replace(/\s+/g, " ");
    const canonicalTitle = normalizeTitle(rawTitle);
    current = {
      title: canonicalTitle,
      lines: [`{B}${canonicalTitle}{/B}`],
      usesCanonicalTitle: rawTitle === canonicalTitle,
    };
  }
  if (current.lines.length > 0) sections.push(current);

  const deduped: CanonicalUsageSection[] = [];
  const indexByTitle = new Map<string, number>();
  for (const section of sections) {
    if (!section.title) {
      deduped.push(section);
      continue;
    }

    const existingIndex = indexByTitle.get(section.title);
    if (existingIndex === undefined) {
      indexByTitle.set(section.title, deduped.length);
      deduped.push(section);
      continue;
    }

    const existing = deduped[existingIndex];
    if (!existing.usesCanonicalTitle && section.usesCanonicalTitle) {
      deduped[existingIndex] = section;
    }
  }

  return deduped
    .flatMap((section) => section.lines)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 사용방법 소제목의 고정 업무 흐름 순서를 반환한다.
 * 각 버튼과 타이틀바는 파서가 제공한 배열 순서를 그대로 유지한다.
 */
export function getUsageSectionTitles(parseResult: ClxParseResult): string[] {
  const menu = parseResult.usage.menuTitleBar;
  const titles: string[] = [];

  if (menu.hasInquiry) titles.push("조회");
  if (menu.hasNew) titles.push("신규");
  if (menu.hasSave) titles.push("저장");
  if (menu.hasDelete) titles.push("삭제");

  titles.push(...menu.extButtons.map((button) => normalizeFrameworkButtonLabel(button.name)));
  titles.push(...parseResult.usage.extraButtons.map((button) => normalizeFrameworkButtonLabel(button.name)));

  for (const titleBar of parseResult.usage.titleBars) {
    const label = titleBar.title || "상세 정보";
    if (titleBar.hasInquiry) titles.push(`${label} - 조회`);
    if (titleBar.hasNew) titles.push(`${label} - 신규`);
    if (titleBar.hasSave) titles.push(`${label} - 저장`);
    if (titleBar.hasDelete) titles.push(`${label} - 삭제`);
    titles.push(...titleBar.extButtons.map((button) => `${label} - ${normalizeFrameworkButtonLabel(button.name)}`));
  }

  return titles;
}

/**
 * AI가 생성한 {B}소제목{/B} 블록을 고정 업무 흐름순으로 정렬한다.
 * 알 수 없는 소제목은 누락하지 않고 마지막에 기존 상대 순서대로 배치한다.
 */
export function sortUsageSections(
  usageText: string,
  parseResult: ClxParseResult
): string {
  const prefixLines: string[] = [];
  const sections: UsageSection[] = [];
  let current: UsageSection | undefined;

  for (const line of usageText.split("\n")) {
    const heading = /^\{B\}(.+?)\{\/B\}$/.exec(line.trim());
    if (heading) {
      if (current) sections.push(current);
      current = {
        title: normalizeTitle(heading[1]),
        lines: [line],
        originalIndex: sections.length,
      };
    } else if (current) {
      current.lines.push(line);
    } else {
      prefixLines.push(line);
    }
  }
  if (current) sections.push(current);

  if (sections.length < 2) return usageText.trim();

  const rankByTitle = new Map<string, number>();
  getUsageSectionTitles(parseResult).forEach((title, index) => {
    const normalized = normalizeTitle(title);
    if (!rankByTitle.has(normalized)) rankByTitle.set(normalized, index);
  });

  // AI 또는 구버전 결과의 "타이틀바명 기능명" 형식도 같은 기능으로 인식한다.
  for (const titleBar of parseResult.usage.titleBars) {
    const label = titleBar.title || "상세 정보";
    for (const operation of ["신규", "저장", "삭제"] as const) {
      const canonical = normalizeTitle(`${label} - ${operation}`);
      const rank = rankByTitle.get(canonical);
      if (rank !== undefined) rankByTitle.set(normalizeTitle(`${label} ${operation}`), rank);
    }
  }

  sections.sort((a, b) => {
    const aRank = rankByTitle.get(a.title) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rankByTitle.get(b.title) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank || a.originalIndex - b.originalIndex;
  });

  const parts: string[] = [];
  const prefix = prefixLines.join("\n").trim();
  if (prefix) parts.push(prefix);
  parts.push(...sections.map((section) => section.lines.join("\n").trim()));
  return parts.filter(Boolean).join("\n\n");
}

function buttonUsageBlock(title: string, buttonName: string, description?: string): string {
  const steps = description
    ?? `Step1. '${buttonName}' 버튼을 클릭한다.\nStep2. 처리 결과를 확인한다.`;
  return `{B}${title}{/B}\n${steps}`;
}

/** AI가 누락한 버튼·타이틀바 섹션을 렌더러 공통 텍스트로 보충한다. */
export function supplementMissingUsageSections(
  usageText: string,
  parseResult: ClxParseResult
): string {
  const presentTitles = new Set(
    [...usageText.matchAll(/^\s*\{B\}(.+?)\{\/B\}\s*$/gm)].map((match) => normalizeTitle(match[1]))
  );
  const supplements: string[] = [];

  const append = (title: string, block: string, aliases: string[] = []) => {
    const candidates = [title, ...aliases].map(normalizeTitle);
    if (candidates.some((candidate) => presentTitles.has(candidate))) return;
    supplements.push(block);
    presentTitles.add(normalizeTitle(title));
  };

  for (const button of parseResult.usage.menuTitleBar.extButtons) {
    const name = normalizeFrameworkButtonLabel(button.name);
    append(name, buttonUsageBlock(name, name, button.description), [button.name]);
  }
  for (const button of parseResult.usage.extraButtons) {
    const name = normalizeFrameworkButtonLabel(button.name);
    append(name, buttonUsageBlock(name, name, button.description), [button.name]);
  }

  for (const titleBar of parseResult.usage.titleBars) {
    const label = titleBar.title || "상세 정보";
    if (titleBar.hasInquiry) {
      const title = `${label} - 조회`;
      append(title, `{B}${title}{/B}\nStep1. ${label}에서 조회 조건을 확인한다.\nStep2. '${label}' 타이틀바의 '조회' 버튼을 클릭하고 결과를 확인한다.`, [`${label} 조회`]);
    }
    if (titleBar.hasNew) {
      const title = `${label} - 신규`;
      append(title, `{B}${title}{/B}\nStep1. 그리드 타이틀바의 '신규' 버튼을 클릭한다.\nStep2. 필수 항목을 입력한다.`, [`${label} 신규`]);
    }
    if (titleBar.hasSave) {
      const title = `${label} - 저장`;
      append(title, `{B}${title}{/B}\nStep1. ${label}에서 신규 입력 또는 수정된 행을 확인한다.\nStep2. 저장 전에 필수 항목과 중복 여부, 변경 상태가 올바른지 검토한다.\nStep3. '${label}' 타이틀바의 '저장' 버튼을 클릭하고, 목록에 변경 내용이 반영되었는지 확인한다.`, [`${label} 저장`]);
    }
    if (titleBar.hasDelete) {
      const title = `${label} - 삭제`;
      append(title, `{B}${title}{/B}\nStep1. ${label}에서 삭제할 행을 선택하고 대상 정보가 맞는지 확인한다.\nStep2. 삭제 전에 다른 업무에서 사용 중인 자료인지와 삭제 제한 조건을 확인한다.\nStep3. '${label}' 타이틀바의 '삭제' 버튼을 클릭하고, 목록에서 해당 행이 제외되었는지 확인한다.`, [`${label} 삭제`]);
    }
    for (const button of titleBar.extButtons) {
      const name = normalizeFrameworkButtonLabel(button.name);
      const title = `${label} - ${name}`;
      append(title, buttonUsageBlock(title, name, button.description), [`${label} - ${button.name}`]);
    }
  }

  if (supplements.length === 0) return usageText;
  return [usageText.trim(), ...supplements].filter(Boolean).join("\n\n");
}

/** 누락 보충과 고정 정렬을 한 번에 적용하는 렌더러/생성기 공용 진입점. */
export function prepareUsageSections(
  usageText: string,
  parseResult: ClxParseResult
): string {
  const canonicalText = canonicalizeUsageSections(usageText);
  const validatedText = filterUnsupportedCrudUsageSections(canonicalText, parseResult);
  return sortUsageSections(supplementMissingUsageSections(validatedText, parseResult), parseResult);
}

export function filterUnsupportedCrudUsageSections(
  usageText: string,
  parseResult: ClxParseResult
): string {
  const allowed = new Set(getUsageSectionTitles(parseResult).map(normalizeTitle));
  const sections: { title?: string; lines: string[] }[] = [];
  let current: { title?: string; lines: string[] } = { lines: [] };

  for (const line of usageText.split("\n")) {
    const heading = /^\s*\{B\}(.+?)\{\/B\}\s*$/.exec(line);
    if (heading) {
      if (current.lines.length > 0) sections.push(current);
      current = { title: normalizeTitle(heading[1]), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0) sections.push(current);

  return sections
    .filter((section) => {
      if (!section.title) return true;
      const match = /^(.+?) - (조회|신규|저장|삭제)$/.exec(section.title);
      return !match || allowed.has(section.title);
    })
    .flatMap((section) => section.lines)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
