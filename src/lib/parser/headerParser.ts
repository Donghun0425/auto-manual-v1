/**
 * 화면 개요 파서
 * - .clx.js 파일 상단 주석 블록에서 시스템 정보를 추출
 */
import type { OverviewInfo, WorkHintInfo } from "@/types";

type WorkHintKey = keyof WorkHintInfo;

const WORK_HINT_LABELS: Record<string, WorkHintKey> = {
  업무흐름: "flow",
  필수사항: "required",
  주의사항: "caution",
};

const WORK_HINT_TAG_RE = /^\[(업무흐름|필수사항|주의사항)\]?\s*(.*)$/;

function stripCommentPrefix(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return "";
  const commentMatch = /^(?:\/\/+|\/\*+|\*\/|\*)\s?(.*)$/.exec(trimmed);
  return commentMatch ? commentMatch[1].trim() : null;
}

function cleanHintText(text: string): string {
  return text
    .replace(/^\s*(?:[-*•]|(?:\d+|[가-힣A-Za-z])[\.)])\s+/, "")
    .trim();
}

function hasWorkHints(hints: WorkHintInfo): boolean {
  return hints.flow.length > 0 || hints.required.length > 0 || hints.caution.length > 0;
}

/**
 * 파일 상단 주석에서 화면 개요 정보를 추출
 */
export function parseHeader(content: string): OverviewInfo {
  const result: OverviewInfo = {
    systemName: "",
    subSystem: "",
    programName: "",
    appTitle: "",
    description: "",
    author: "",
    createDate: "",
  };

  const systemMatch = content.match(/\/\/\s*\[시스템명\]\s*(.+)/);
  if (systemMatch) result.systemName = systemMatch[1].trim();

  const subSystemMatch = content.match(/\/\/\s*\[부시스템\]\s*(.+)/);
  if (subSystemMatch) result.subSystem = subSystemMatch[1].trim();

  const programMatch = content.match(/\/\/\s*\[프로그램\]\s*(.+)/);
  if (programMatch) result.programName = programMatch[1].trim();

  const descMatch = content.match(/\/\/\s*\[설명\]\s*(.+)/);
  if (descMatch) result.description = descMatch[1].trim();

  const authorMatch = content.match(/\/\/\s*\[작성자명\]\s*(.+)/);
  if (authorMatch) result.author = authorMatch[1].trim();

  const dateMatch = content.match(/\/\/\s*\[작성일자\]\s*(.+)/);
  if (dateMatch) result.createDate = dateMatch[1].trim();

  const appTitleMatch = content.match(/app\.title\s*=\s*"([^"]+)"/);
  if (appTitleMatch) result.appTitle = appTitleMatch[1].trim();

  return result;
}

/**
 * 파일 상단 주석의 업무 힌트를 추출한다.
 *
 * 지원 형식:
 * // [업무흐름] 교과목관리 → 강좌개설 → 수강신청
 * // [필수사항]
 * // - 교과목 선등록 필요
 * // [주의사항] 수강신청 이후 수정 제한
 */
export function parseWorkHints(content: string): WorkHintInfo | undefined {
  const result: WorkHintInfo = {
    flow: [],
    required: [],
    caution: [],
  };

  let currentKey: WorkHintKey | null = null;

  for (const line of content.split(/\r?\n/)) {
    const commentText = stripCommentPrefix(line);

    if (commentText === null) {
      currentKey = null;
      continue;
    }

    if (!commentText) continue;

    const tagMatch = WORK_HINT_TAG_RE.exec(commentText);
    if (tagMatch) {
      currentKey = WORK_HINT_LABELS[tagMatch[1]];
      const inlineText = cleanHintText(tagMatch[2]);
      if (inlineText) result[currentKey].push(inlineText);
      continue;
    }

    if (/^\[[^\]]+\]/.test(commentText)) {
      currentKey = null;
      continue;
    }

    if (currentKey) {
      const hintText = cleanHintText(commentText);
      if (hintText) result[currentKey].push(hintText);
    }
  }

  return hasWorkHints(result) ? result : undefined;
}
