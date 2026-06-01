/**
 * UDC 컨텍스트 보강
 *
 * CLX 파싱 결과의 usedUdcs 와 원본 CLX 본문을 입력받아,
 * UDC DB 에서 상세를 조회하고 라벨 오버라이드를 해석하여
 * AI 프롬프트에 주입할 UdcEnrichmentContext 를 구성한다.
 *
 * - UDC DB 가 비어있거나 조회 실패 시 graceful degradation (available=false)
 * - 동일 요청 내 반복 조회를 줄이기 위한 5분 TTL 인메모리 캐시
 */
import type { ClxParseResult, UdcEnrichmentContext, ResolvedUdcInfo } from "@/types";
import { getUdcDetailsByShortNames } from "@/lib/supabase/queries/udc";
import { resolveUdc, type UdcDetail } from "@/lib/parser/udc-label-resolver";

interface CacheEntry {
  detail: UdcDetail;
  expires: number;
}

const TTL_MS = 5 * 60 * 1000;
const detailCache = new Map<string, CacheEntry>();

/** 캐시에서 유효한 상세를 가져온다 (만료 항목 제거) */
function getCached(shortName: string): UdcDetail | undefined {
  const entry = detailCache.get(shortName);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    detailCache.delete(shortName);
    return undefined;
  }
  return entry.detail;
}

function setCached(shortName: string, detail: UdcDetail): void {
  detailCache.set(shortName, { detail, expires: Date.now() + TTL_MS });
}

/**
 * CLX 파싱 결과에 대한 UDC 보강 컨텍스트를 구성한다.
 * @param parseResult 파싱 결과 (usedUdcs 포함)
 * @param clxContent  원본 CLX 본문 (라벨 오버라이드 해석용)
 */
export async function enrichUdcContext(
  parseResult: ClxParseResult,
  clxContent: string
): Promise<UdcEnrichmentContext> {
  const shortNames = parseResult.usedUdcs.map((u) => u.shortName);
  if (shortNames.length === 0) {
    return { udcs: [], available: false };
  }

  // 캐시 미스 항목만 DB 조회
  const missing = shortNames.filter((n) => !getCached(n));
  if (missing.length > 0) {
    try {
      const fetched = await getUdcDetailsByShortNames(missing);
      for (const [name, detail] of fetched) {
        setCached(name, detail);
      }
    } catch {
      // DB 미연동/오류 → 캐시된 것만으로 진행 (graceful degradation)
    }
  }

  const resolved: ResolvedUdcInfo[] = [];
  for (const name of shortNames) {
    const detail = getCached(name);
    if (detail) {
      resolved.push(resolveUdc(detail, clxContent));
    }
  }

  return { udcs: resolved, available: resolved.length > 0 };
}

/**
 * 컨트롤 ID → 최종 라벨 맵을 구성한다 (프롬프트 주입용 헬퍼).
 * UDC 가 오버라이드한 라벨을 CLX 컨트롤 라벨보다 우선 적용할 때 사용.
 */
export function buildLabelOverrideMap(ctx: UdcEnrichmentContext): Map<string, string> {
  const map = new Map<string, string>();
  for (const udc of ctx.udcs) {
    for (const label of udc.resolvedLabels) {
      if (label.targetControlId) {
        map.set(label.targetControlId, label.resolvedLabel);
      }
    }
  }
  return map;
}

/**
 * UDC 보강 정보를 프롬프트용 텍스트 블록으로 변환한다.
 * 비어있으면 빈 문자열 반환 (프롬프트에 추가하지 않음).
 */
export function formatUdcHint(ctx: UdcEnrichmentContext): string {
  if (!ctx.available || ctx.udcs.length === 0) return "";

  const lines: string[] = [];
  for (const udc of ctx.udcs) {
    const parts: string[] = [`· ${udc.displayName}`];

    const labels = udc.resolvedLabels
      .filter((l) => l.resolvedLabel)
      .map((l) => l.resolvedLabel);
    if (labels.length) parts.push(`항목: ${labels.join(", ")}`);

    if (udc.componentType === "cascading_combo" && udc.cascade) {
      parts.push("(상위 선택에 따라 하위 항목이 연동되어 바뀝니다)");
    }
    if (udc.gridColumns.length) {
      parts.push(`표시 컬럼: ${udc.gridColumns.map((c) => c.header).join(", ")}`);
    }
    if (udc.actions.length) {
      const acts = udc.actions
        .map((a) => a.label ?? a.controlId)
        .filter(Boolean);
      if (acts.length) parts.push(`동작: ${acts.join(", ")}`);
    }

    lines.push(parts.join(" / "));
  }

  return `\n[참고: 이 화면에서 사용된 공통 컴포넌트(UDC) 정보]\n${lines.join("\n")}\n`;
}
