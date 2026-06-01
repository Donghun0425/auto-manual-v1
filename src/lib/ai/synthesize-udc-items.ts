/**
 * UDC 캡슐화 콘텐츠 합성 주입
 *
 * UDC(udc.js)에 캡슐화되어 CLX 본문에는 보이지 않는 내부 콘텐츠를
 * UDC DB 경유 보강 컨텍스트에서 끌어와, 파싱 결과의
 *  - 항목(items.infoGroups): info 형 UDC 의 내부 표시 필드 → "인포영역" 그룹
 *  - 사용방법(usage.titleBars 버튼): UDC 내부 버튼 → 대응 인포 타이틀바 버튼
 * 으로 합성 주입한다.
 *
 * 예) UcoStdntInfo01(D_STDNT_INFO): 학번/성명/학과 등 20개 필드 + 사진등록/사진삭제 버튼이
 *     INFOGROUP01 안의 UDC 인스턴스 하나로만 선언되어 기존 파서가 누락하던 문제를 해소.
 */
import type {
  ClxParseResult,
  UdcEnrichmentContext,
  ResolvedUdcInfo,
  ConditionControlInfo,
  CrudInfo,
} from "@/types";

/**
 * UDC 보강 컨텍스트의 내부 콘텐츠를 파싱 결과에 합성 주입한다 (in-place).
 * 보강 불가(available=false) 시 아무것도 하지 않는다 (graceful degradation).
 */
export function applyUdcSynthesis(
  parseResult: ClxParseResult,
  ctx: UdcEnrichmentContext,
  clxContent: string
): void {
  if (!ctx.available || ctx.udcs.length === 0) return;

  for (const udc of ctx.udcs) {
    const groupTitle = resolveUdcGroupTitle(clxContent, udc);

    // 항목: info 형 UDC 의 내부 표시 필드
    if (udc.componentType === "info") {
      injectInfoGroup(parseResult, udc, groupTitle);
    }

    // 사용방법: UDC 내부 버튼 (라벨 보유분)
    if (udc.actions.some((a) => a.label)) {
      injectUdcButtons(parseResult, udc, groupTitle);
    }
  }
}

/** info 형 UDC 의 내부 표시 필드를 인포영역 그룹으로 항목에 추가 */
function injectInfoGroup(
  parseResult: ClxParseResult,
  udc: ResolvedUdcInfo,
  title: string
): void {
  const seen = new Set<string>();
  const fields = udc.resolvedLabels.filter((l) => {
    const label = l.resolvedLabel?.trim();
    if (!label || seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (fields.length === 0) return;

  const groupId = `UDC_${udc.shortName}`;
  if (parseResult.items.infoGroups.some((g) => g.groupId === groupId)) return;

  const controls: ConditionControlInfo[] = fields.map((l, i) => ({
    controlId: l.targetControlId ?? `${groupId}_${i}`,
    labelText: l.resolvedLabel,
    description: "",
    controlType: "output",
    inputType: "표시",
  }));

  parseResult.items.infoGroups.push({ groupId, title, controls });
}

/** UDC 내부 버튼을 대응 인포 타이틀바(없으면 신규)의 버튼으로 추가 → 사용방법 노출 */
function injectUdcButtons(
  parseResult: ClxParseResult,
  udc: ResolvedUdcInfo,
  title: string
): void {
  const buttons = udc.actions.filter((a) => a.label);
  if (buttons.length === 0) return;

  let bar = parseResult.usage.titleBars.find((tb) => tb.title === title);
  if (!bar) {
    const newBar: CrudInfo = {
      hasInquiry: false,
      hasNew: false,
      hasSave: false,
      hasDelete: false,
      extButtons: [],
      title,
    };
    parseResult.usage.titleBars.push(newBar);
    bar = newBar;
  }

  const existing = new Set(bar.extButtons.map((b) => b.name));
  let idx = 900;
  for (const btn of buttons) {
    const name = btn.label!;
    if (existing.has(name)) continue;
    existing.add(name);
    bar.extButtons.push({
      name,
      functionName: `UDC_${btn.controlId}`,
      index: idx++,
    });
  }
}

/**
 * UDC 인스턴스가 속한 인포영역의 타이틀(예: "학생 기본 정보")을 해석한다.
 * CLX 의 INFOGROUP{N} 컨테이너 ↔ CT_INFOTITLE{N} 타이틀바 대응을 이용하며,
 * 찾지 못하면 UDC displayName 으로 폴백한다.
 */
function resolveUdcGroupTitle(content: string, udc: ResolvedUdcInfo): string {
  const instRe = new RegExp(`new\\s+udc\\.\\w+\\.${udc.shortName}\\s*\\(\\s*"([^"]+)"`);
  const m = instRe.exec(content);
  if (m) {
    const containerId = findEnclosingContainer(content, m.index);
    const num = containerId?.match(/(\d+)$/)?.[1];
    if (num) {
      const title = findInfoTitle(content, num);
      if (title) return title;
    }
  }
  return udc.displayName || udc.shortName;
}

/** UDC 인스턴스 선언을 감싸는 Container 컨트롤 id 추출 (INFOGROUP01 등) */
function findEnclosingContainer(content: string, declStart: number): string | undefined {
  // 선언 직후의 IIFE 종료 `})(group_N)` 에서 컨테이너 변수명 추출
  const after = content.slice(declStart, declStart + 800);
  const grpVar = /\}\)\(\s*(\w+)\s*\)/.exec(after)?.[1];
  if (!grpVar) return undefined;
  const contRe = new RegExp(
    `var\\s+${grpVar}\\s*=\\s*(?:[\\w.]+\\s*=\\s*)?new\\s+cpr\\.controls\\.Container\\(\\s*"([^"]+)"`
  );
  return contRe.exec(content)?.[1];
}

/** CT_INFOTITLE{num} 타이틀바의 title 텍스트 추출 */
function findInfoTitle(content: string, num: string): string | undefined {
  const barRe = new RegExp(
    `var\\s+(\\w+)\\s*=\\s*(?:[\\w.]+\\s*=\\s*)?new\\s+udc\\.common\\.PatisTitleBar\\(\\s*"CT_INFOTITLE${num}"`
  );
  const varName = barRe.exec(content)?.[1];
  if (!varName) return undefined;
  return new RegExp(`\\b${varName}\\.title\\s*=\\s*"([^"]+)"`).exec(content)?.[1];
}
