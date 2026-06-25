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
  VisibleOverride,
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
 * CLX 본문에서 UDC 인스턴스의 *Visible = false/true 설정을 추출한다.
 *
 * 지원 패턴 (등장 순서 기준, 나중이 최종값):
 *   app.lookup("S_ACNTG_COMBO").bplcCdVisible = false       (속성 할당)
 *   app.lookup("S_ACNTG_COMBO").setBplcCdVisible(false)          (메서드 호출)
 *   varName.bplcCdVisible = false                                (변수 선언 직후)
 */
function extractVisibleOverrides(clxContent: string): VisibleOverride[] {
  const all: { instanceId: string; propertyName: string; visible: boolean; position: number }[] = [];

  // 패턴 ①: 속성 직접 할당
  //   app.lookup("ID").bplcCdVisible = false
  const re1 = /app\.lookup\("(\w+)"\)\.(\w+Visible)\s*=\s*(false|true)/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(clxContent)) !== null) {
    all.push({ instanceId: m[1], propertyName: m[2], visible: m[3] === 'true', position: m.index });
  }

  // 패턴 ②: 메서드 호출
  //   app.lookup("ID").setBplcCdVisible(false)
  const re2 = /app\.lookup\("(\w+)"\)\.set(\w+Visible)\s*\(\s*(false|true)\s*\)/g;
  while ((m = re2.exec(clxContent)) !== null) {
    const rawName = m[2]; // "BplcCdVisible"
    const propertyName = rawName[0].toLowerCase() + rawName.slice(1);
    all.push({ instanceId: m[1], propertyName, visible: m[3] === 'true', position: m.index });
  }

  // 패턴 ③: 변수 선언 직후 속성 할당
  //   var xxx = new udc.pkg.Name("ID"); xxx.bplcCdVisible = false
  const re3 = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+udc\.\w+\.\w+\s*\(\s*"(\w+)"\s*\)/g;
  while ((m = re3.exec(clxContent)) !== null) {
    const varName = m[1];
    const controlId = m[2];
    const afterDecl = clxContent.slice(m.index, m.index + 500);
    const visibleRe = new RegExp(`\\b${varName}\\.(\\w+Visible)\\s*=\\s*(false|true)`, 'g');
    let vm: RegExpExecArray | null;
    while ((vm = visibleRe.exec(afterDecl)) !== null) {
      all.push({ instanceId: controlId, propertyName: vm[1], visible: vm[2] === 'true', position: m.index + vm.index });
    }
  }

  // 동일 (instanceId + propertyName) 조합은 position이 큰 쪽(나중 코드)이 최종값
  const latestMap = new Map<string, { instanceId: string; propertyName: string; visible: boolean; position: number }>();
  for (const item of all) {
    const key = `${item.instanceId}.${item.propertyName}`;
    const existing = latestMap.get(key);
    if (!existing || item.position > existing.position) {
      latestMap.set(key, item);
    }
  }

  // 최종 visible=false 항목만 반환
  return [...latestMap.values()]
    .filter(item => !item.visible)
    .map(({ instanceId, propertyName, visible }) => ({ instanceId, propertyName, visible }));
}

/**
 * Supabase udc_property 의 target_attribute='visible' 매핑을 사용하여
 * CLX 파일에서 visible=false 로 설정된 컨트롤의 라벨을 필터링한다.
 *
 * @param detail    Supabase UDC 상세 (properties 포함)
 * @param overrides CLX 파일에서 추출한 *Visible 설정
 * @param labels    필터링 전 라벨 목록
 * @returns         visible=true 인 컨트롤의 라벨만 남긴 목록
 */
function applyVisibleFilter(
  detail: UdcDetail,
  overrides: VisibleOverride[],
  labels: LabelResolution[]
): LabelResolution[] {
  // udc_property 중 target_attribute='visible' 인 항목 → property_name → target_control_id 맵
  const visiblePropMap = new Map<string, string>();
  for (const prop of detail.properties) {
    if (prop.target_attribute === 'visible' && prop.target_control_id) {
      visiblePropMap.set(prop.property_name, prop.target_control_id);
    }
  }

  // visible 프로퍼티가 없으면 필터링 불필요
  if (visiblePropMap.size === 0) return labels;

  // CLX 파일에서 false 로 명시된 visible 프로퍼티 수집
  const hiddenControlIds = new Set<string>();
  for (const ov of overrides) {
    if (ov.visible) continue;
    const targetCtrlId = visiblePropMap.get(ov.propertyName);
    if (targetCtrlId) {
      hiddenControlIds.add(targetCtrlId);
    }
  }

  if (hiddenControlIds.size === 0) return labels;

  // visible=false 인 컨트롤의 라벨 제외
  return labels.filter(l => !hiddenControlIds.has(l.targetControlId ?? ''));
}

/**
 * 단일 UDC 의 최종 매뉴얼 보강 정보를 해석한다.
 */
export function resolveUdc(detail: UdcDetail, clxContent: string): ResolvedUdcInfo {
  const calls = extractSetterCalls(clxContent);
  const visibleOverrides = extractVisibleOverrides(clxContent);
  const resolvedLabels = applyVisibleFilter(
    detail,
    visibleOverrides,
    applyOverrides(detail, calls, baseLabels(detail))
  );

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
