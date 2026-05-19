/**
 * 임베디드 앱(탭페이지) 파서
 * - PatisUtils.loadEmbApp 호출부에서 탭페이지 정보 추출
 * - new cpr.controls.EmbeddedApp 선언부 + 직전 tabItem.text 레이블 추출
 */
import type { TabPageInfo } from "@/types";

/**
 * loadEmbApp 호출부에서 탭페이지 정보를 추출
 */
export function parseEmbApps(content: string): TabPageInfo[] {
  const tabPages: TabPageInfo[] = [];
  let m: RegExpExecArray | null;

  // Step 1: loadEmbApp에서 embId → 실제 파일경로 맵 생성
  const embIdToUri = new Map<string, string>();
  const loadScanRe = /PatisUtils\.loadEmbApp\(\s*(?:app\.lookup\s*\(\s*"([^"]+)"\s*\)|(\w+))\s*,\s*"([^"]+)"/g;
  while ((m = loadScanRe.exec(content)) !== null) {
    const embId = m[1] || m[2];
    const appUri = m[3];
    if (embId && !embIdToUri.has(embId)) {
      embIdToUri.set(embId, appUri);
    }
  }

  // Step 2: EmbeddedApp 선언부에서 embId → tabLabel 맵 생성
  const embIdToLabel = new Map<string, string>();
  const embDeclRe = /new\s+cpr\.controls\.EmbeddedApp\s*\(\s*"([^"]+)"\s*\)/g;
  while ((m = embDeclRe.exec(content)) !== null) {
    const embId = m[1];
    const before = content.slice(Math.max(0, m.index - 800), m.index);
    const textRe = /(?:tabItem_\d+|tabItem)\s*\.text\s*=\s*"([^"]+)"/g;
    let lastText: string | undefined;
    let tm: RegExpExecArray | null;
    while ((tm = textRe.exec(before)) !== null) lastText = tm[1];
    if (lastText) embIdToLabel.set(embId, lastText);
  }

  // Step 3: EmbeddedApp 선언부 기반 TabPageInfo 생성
  const seenUri = new Set<string>();
  const seenEmbId = new Set<string>();

  for (const [embId, tabLabel] of embIdToLabel.entries()) {
    const realUri = embIdToUri.get(embId) ?? embId;
    if (!seenUri.has(realUri)) {
      seenUri.add(realUri);
      seenEmbId.add(embId);
      tabPages.push({ appUri: realUri, calledFrom: "layout", tabLabel });
    }
  }

  // Step 4: 선언부가 없고 loadEmbApp만 있는 경우
  const loadRe = /PatisUtils\.loadEmbApp\(\s*(?:app\.lookup\s*\(\s*"([^"]+)"\s*\)|(\w+))\s*,\s*"([^"]+)"/g;
  while ((m = loadRe.exec(content)) !== null) {
    const embId = m[1] || m[2];
    const appUri = m[3];
    if (embId && seenEmbId.has(embId)) continue;
    if (seenUri.has(appUri)) continue;
    seenUri.add(appUri);
    const calledFrom = findEnclosingFunction(content, m.index);
    tabPages.push({ appUri, calledFrom });
  }

  return tabPages;
}

function findEnclosingFunction(content: string, position: number): string {
  const before = content.substring(0, position);
  const funcPattern = /function\s+(\w+)\s*\(/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = funcPattern.exec(before)) !== null) {
    lastMatch = match;
  }
  return lastMatch ? lastMatch[1] : "unknown";
}
