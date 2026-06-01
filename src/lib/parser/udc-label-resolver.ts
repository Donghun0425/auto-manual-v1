/**
 * UDC 라벨 해석기
 *
 * CLX 파일(.clx.js)에서 UDC 인스턴스에 대한 setter 호출을 찾아,
 * UDC 의 기본 라벨이 어떤 값으로 오버라이드되는지 추적한다.
 *
 * 핵심 패턴:
 *   app.lookup("S_YR_SMSTR_SE").setYrLabel("재정연도")
 *   → UcoYrSmstrCombo 의 setYrLabel 함수가 yrLabel 프로퍼티(기본 "연도")를
 *      "재정연도" 로 오버라이드 → 영향 컨트롤 T_S_YR
 */
import type {
  LabelResolution,
  ResolvedUdcInfo,
  UdcComponent,
  UdcControl,
  UdcProperty,
  UdcFunction,
} from "@/types";

/** UDC 상세 (컴포넌트 + 하위 엔티티) — 라벨 해석 입력 */
export interface UdcDetail {
  component: UdcComponent;
  controls: UdcControl[];
  properties: UdcProperty[];
  functions: UdcFunction[];
}

/** CLX 본문에서 발견된 UDC 인스턴스 setter 호출 */
interface SetterCall {
  instanceId: string;
  functionName: string;
  argLabel: string;
}

/**
 * CLX 본문에서 setter 호출을 추출한다.
 * 매칭: app.lookup("ID").funcName("문자열인자")
 */
function extractSetterCalls(clxContent: string): SetterCall[] {
  const calls: SetterCall[] = [];
  const re = /app\.lookup\("(\w+)"\)\.(\w+)\(\s*["'](.+?)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clxContent)) !== null) {
    calls.push({ instanceId: m[1], functionName: m[2], argLabel: m[3] });
  }
  return calls;
}

/**
 * 단일 UDC 의 기본 라벨 목록을 구성한다 (오버라이드 전 상태).
 */
function baseLabels(detail: UdcDetail): LabelResolution[] {
  const result: LabelResolution[] = [];
  for (const ctrl of detail.controls) {
    if (ctrl.is_label_control && ctrl.default_label) {
      result.push({
        shortName: detail.component.short_name,
        functionName: "",
        resolvedLabel: ctrl.default_label,
        targetControlId: ctrl.control_id,
        defaultLabel: ctrl.default_label,
      });
    }
  }
  return result;
}

/**
 * setter 호출을 라벨 함수에 매핑하여 라벨 오버라이드를 해석한다.
 */
function applyOverrides(
  detail: UdcDetail,
  calls: SetterCall[],
  base: LabelResolution[]
): LabelResolution[] {
  const labelFns = new Set(
    detail.functions
      .filter((f) => f.function_type === "set_label")
      .map((f) => f.function_name)
  );
  const propByName = new Map(detail.properties.map((p) => [p.property_name, p]));
  const resolved = [...base];

  for (const call of calls) {
    if (!labelFns.has(call.functionName)) continue;

    const fn = detail.functions.find((f) => f.function_name === call.functionName);
    const targetProp = fn?.target_properties[0];
    const prop = targetProp ? propByName.get(targetProp) : undefined;
    const targetControlId = prop?.target_control_id ?? null;
    const defaultLabel = prop?.default_value ?? null;

    // 동일 컨트롤의 기본 라벨 항목을 오버라이드, 없으면 추가
    const existing = targetControlId
      ? resolved.find((r) => r.targetControlId === targetControlId)
      : undefined;

    if (existing) {
      existing.resolvedLabel = call.argLabel;
      existing.functionName = call.functionName;
    } else {
      resolved.push({
        shortName: detail.component.short_name,
        functionName: call.functionName,
        resolvedLabel: call.argLabel,
        targetControlId,
        defaultLabel,
      });
    }
  }

  return resolved;
}

/**
 * 단일 UDC 의 최종 매뉴얼 보강 정보를 해석한다.
 */
export function resolveUdc(detail: UdcDetail, clxContent: string): ResolvedUdcInfo {
  const calls = extractSetterCalls(clxContent);
  const resolvedLabels = applyOverrides(detail, calls, baseLabels(detail));

  const gridColumns =
    detail.controls.find((c) => c.control_type === "grid")?.grid_columns ?? [];

  const cascade =
    detail.controls.find((c) => c.cascade_config !== null)?.cascade_config ?? null;

  const actions = detail.controls
    .filter((c) => c.control_type === "button" && (c.action_type || c.default_label))
    .map((c) => ({
      controlId: c.control_id,
      actionType: c.action_type,
      actionTarget: c.action_target,
      label: c.default_label,
    }));

  return {
    shortName: detail.component.short_name,
    qualifiedName: detail.component.qualified_name,
    displayName: detail.component.display_name,
    componentType: detail.component.component_type,
    description: detail.component.description,
    sectionUsage: detail.component.section_usage,
    resolvedLabels,
    gridColumns: gridColumns ?? [],
    cascade,
    actions,
  };
}
