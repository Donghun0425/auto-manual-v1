/**
 * 화면 개요 파서
 * - .clx.js 파일 상단 주석 블록에서 시스템 정보를 추출
 */
import type { OverviewInfo } from "@/types";

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
