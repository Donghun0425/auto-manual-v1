/**
 * Embedded app / tab page parser.
 *
 * Only pages actually loaded through PatisUtils.loadEmbApp are returned.
 * EmbeddedApp declarations are used as embId -> tab label hints.
 */
import type { TabPageInfo } from "@/types";

export function parseEmbApps(content: string): TabPageInfo[] {
  const tabPages: TabPageInfo[] = [];
  const embIdToLabel = collectEmbIdLabels(content);
  const seenUri = new Set<string>();
  const seenEmbId = new Set<string>();

  const loadRe = /PatisUtils\.loadEmbApp\(\s*(?:app\.lookup\s*\(\s*"([^"]+)"\s*\)|(\w+))\s*,\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;

  while ((m = loadRe.exec(content)) !== null) {
    const directEmbId = m[1];
    const aliasName = m[2];
    const embId = directEmbId || (aliasName ? findAliasedEmbId(content, m.index, aliasName) : undefined);
    const appUri = m[3];

    if (seenUri.has(appUri)) continue;
    if (embId && seenEmbId.has(embId)) continue;

    seenUri.add(appUri);
    if (embId) seenEmbId.add(embId);

    const tabLabel = embId ? embIdToLabel.get(embId) : undefined;
    tabPages.push({
      appUri,
      calledFrom: findEnclosingFunction(content, m.index),
      ...(tabLabel ? { tabLabel } : {}),
    });
  }

  return tabPages;
}

function collectEmbIdLabels(content: string): Map<string, string> {
  const embIdToLabel = new Map<string, string>();
  const embDeclRe = /new\s+cpr\.controls\.EmbeddedApp\s*\(\s*"([^"]+)"\s*\)/g;
  let m: RegExpExecArray | null;

  while ((m = embDeclRe.exec(content)) !== null) {
    const embId = m[1];
    const before = content.slice(Math.max(0, m.index - 800), m.index);
    const textRe = /(?:tabItem_\d+|tabItem)\s*\.text\s*=\s*"([^"]+)"/g;
    let lastText: string | undefined;
    let tm: RegExpExecArray | null;

    while ((tm = textRe.exec(before)) !== null) {
      lastText = tm[1];
    }

    if (lastText) embIdToLabel.set(embId, lastText);
  }

  return embIdToLabel;
}

function findAliasedEmbId(content: string, position: number, varName: string): string | undefined {
  const before = content.slice(findEnclosingFunctionStart(content, position), position);
  const safeVar = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const aliasRe = new RegExp(
    `(?:\\b(?:var|let|const)\\s+)?${safeVar}\\s*=\\s*app\\.lookup\\(\\s*"([^"]+)"\\s*\\)`,
    "g"
  );

  let lastEmbId: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = aliasRe.exec(before)) !== null) {
    lastEmbId = m[1];
  }
  return lastEmbId;
}

function findEnclosingFunctionStart(content: string, position: number): number {
  const before = content.substring(0, position);
  const funcPattern = /function\s+\w+\s*\(/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = funcPattern.exec(before)) !== null) {
    lastIndex = match.index;
  }

  return lastIndex;
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
