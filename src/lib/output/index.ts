/**
 * 매뉴얼 출력 엔진 — 진입점
 * ParseResult + LayoutSections → HTML/MD 콘텐츠 생성
 */
import type { ClxParseResult, LayoutSection } from "@/types";
import { renderHtml } from "./html-renderer";
import { renderMarkdown } from "./markdown-renderer";

const DEFAULT_SECTIONS: LayoutSection[] = [
  { id: "overview", name: "화면개요", enabled: true, order: 0 },
  { id: "usage", name: "사용법", enabled: true, order: 1 },
  { id: "conditions", name: "조건그룹", enabled: true, order: 2 },
  { id: "info", name: "인포그룹", enabled: true, order: 3 },
  { id: "grid", name: "그리드", enabled: true, order: 4 },
  { id: "popup", name: "팝업", enabled: true, order: 5 },
  { id: "tabs", name: "탭페이지", enabled: false, order: 6 },
  { id: "notes", name: "주의사항", enabled: true, order: 7 },
];

export interface RenderOptions {
  sections?: LayoutSection[];
  formats: ("html" | "md")[];
}

export interface RenderResult {
  htmlContent?: string;
  markdownContent?: string;
}

/**
 * 파싱 결과를 레이아웃에 따라 HTML/MD로 렌더링
 */
export function renderManual(
  parseResult: ClxParseResult,
  options: RenderOptions
): RenderResult {
  const sections = options.sections ?? DEFAULT_SECTIONS;
  const result: RenderResult = {};

  if (options.formats.includes("html")) {
    result.htmlContent = renderHtml(parseResult, sections);
  }

  if (options.formats.includes("md")) {
    result.markdownContent = renderMarkdown(parseResult, sections);
  }

  return result;
}

export { renderHtml, renderMarkdown };
