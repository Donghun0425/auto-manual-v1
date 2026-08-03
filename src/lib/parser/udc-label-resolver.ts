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
  ResolvedUdcAction,
  ResolvedUdcInfo,
  ResolvedVisibility,
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

interface UdcFunctionCall {
  instanceId: string;
  functionName: string;
  args: (string | boolean | undefined)[];
  position: number;
}

interface UdcInstance {
  instanceId: string;
  variableName: string;
}

interface FileUploadActionSpec {
  controlId: string;
  labelProperties: string[];
  visibleProperty: string;
  labelSetterNames?: string[];
  visibleSetterNames?: string[];
  singleUploadOnly?: boolean;
}

const FILE_UPLOAD_ACTION_SPECS: FileUploadActionSpec[] = [
  {
    controlId: "BTN_UPLOAD_POPUP_OPEN",
    labelProperties: ["selectButtonText"],
    visibleProperty: "isSelectButtonVisible",
    visibleSetterNames: ["setSelectButtonVisible"],
    singleUploadOnly: true,
  },
  {
    controlId: "BTN_DOWNLOAD",
    labelProperties: ["downloadButtonText"],
    visibleProperty: "isDownloadButtonVisible",
  },
  {
    controlId: "BTN_DELETE",
    labelProperties: ["deleteButtonText"],
    visibleProperty: "isDeleteButtonVisible",
  },
  {
    controlId: "BTN_INQ",
    labelProperties: ["searchButtonText", "inqButtonText"],
    visibleProperty: "isInqButtonVisible",
    labelSetterNames: ["setInqButtonText"],
  },
  {
    controlId: "BTN_SAVE",
    labelProperties: ["saveButtonText"],
    visibleProperty: "isSaveButtonVisible",
    singleUploadOnly: true,
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLiteral(raw: string): string | boolean {
  if (raw === "true" || raw === "false") return raw === "true";
  const quote = raw[0];
  const value = raw.slice(1, -1);
  if (quote === '"') {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return value;
    }
  }
  return value.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function splitCallArguments(raw: string): string[] {
  const result: string[] = [];
  let start = 0;
  let quote = "";
  let escaped = false;
  let depth = 0;
  for (let i = 0; i <= raw.length; i++) {
    const char = raw[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;
    else if ((char === "," && depth === 0) || i === raw.length) {
      result.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  return result.length === 1 && result[0] === "" ? [] : result;
}

function parseCallLiteral(raw: string): string | boolean | undefined {
  const value = raw.trim();
  if (value === "true" || value === "false") return value === "true";
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return parseLiteral(value);
  }
  return undefined;
}

function findUdcInstances(clxContent: string, shortName: string): UdcInstance[] {
  const result: UdcInstance[] = [];
  const re = new RegExp(
    `var\\s+(\\w+)\\s*=\\s*(?:linker\\.\\w+\\s*=\\s*)?new\\s+udc\\.\\w+\\.${escapeRegExp(shortName)}\\s*\\(\\s*["']([^"']+)["']`,
    "g"
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(clxContent)) !== null) {
    result.push({ variableName: match[1], instanceId: match[2] });
  }
  return result;
}

function extractInstanceFunctionCalls(
  clxContent: string,
  instances: UdcInstance[]
): UdcFunctionCall[] {
  const calls: UdcFunctionCall[] = [];
  for (const instance of instances) {
    const instanceId = escapeRegExp(instance.instanceId);
    const variableName = escapeRegExp(instance.variableName);
    const patterns = [
      new RegExp(`app\\.lookup\\(["']${instanceId}["']\\)\\.(\\w+)\\s*\\(([^)]*)\\)`, "g"),
      new RegExp(`\\b${variableName}\\.(\\w+)\\s*\\(([^)]*)\\)`, "g"),
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(clxContent)) !== null) {
        calls.push({
          instanceId: instance.instanceId,
          functionName: match[1],
          args: splitCallArguments(match[2]).map(parseCallLiteral),
          position: match.index,
        });
      }
    }
  }
  calls.sort((a, b) => a.position - b.position);
  return calls;
}

/** UDC 인스턴스에 적용된 문자열/불리언 프로퍼티의 최종값을 코드 등장 순서로 해석한다. */
function findInstanceOverride(
  clxContent: string,
  instance: UdcInstance,
  propertyName: string,
  setterNames: string[] = []
): string | boolean | undefined {
  return findInstanceOverrideResult(
    clxContent,
    instance,
    propertyName,
    setterNames
  )?.value;
}

function findInstanceOverrideResult(
  clxContent: string,
  instance: UdcInstance,
  propertyName: string,
  setterNames: string[] = []
): { value: string | boolean | undefined; position: number } | undefined {
  const literal = `(true|false|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`;
  const instanceId = escapeRegExp(instance.instanceId);
  const variableName = escapeRegExp(instance.variableName);
  const property = escapeRegExp(propertyName);
  const defaultSetter = `set${propertyName[0].toUpperCase()}${propertyName.slice(1)}`;
  const setters = [...new Set([defaultSetter, ...setterNames])].map(escapeRegExp).join("|");
  const matches: { position: number; value: string | boolean | undefined }[] = [];

  const patterns = [
    new RegExp(`app\\.lookup\\(["']${instanceId}["']\\)\\.${property}\\s*=\\s*${literal}`, "g"),
    new RegExp(`\\b${variableName}\\.${property}\\s*=\\s*${literal}`, "g"),
    new RegExp(`app\\.lookup\\(["']${instanceId}["']\\)\\.(?:${setters})\\s*\\(\\s*${literal}`, "g"),
    new RegExp(`\\b${variableName}\\.(?:${setters})\\s*\\(\\s*${literal}`, "g"),
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clxContent)) !== null) {
      matches.push({ position: match.index, value: parseLiteral(match[1]) });
    }
  }

  const dynamicPatterns = [
    new RegExp(`app\\.lookup\\(["']${instanceId}["']\\)\\.${property}\\s*=\\s*([^;\\r\\n]+)`, "g"),
    new RegExp(`\\b${variableName}\\.${property}\\s*=\\s*([^;\\r\\n]+)`, "g"),
    new RegExp(`app\\.lookup\\(["']${instanceId}["']\\)\\.(?:${setters})\\s*\\(\\s*([^)]*)\\)`, "g"),
    new RegExp(`\\b${variableName}\\.(?:${setters})\\s*\\(\\s*([^)]*)\\)`, "g"),
  ];
  for (const pattern of dynamicPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clxContent)) !== null) {
      const raw = match[1].trim();
      if (/^(?:true|false|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')$/.test(raw)) continue;
      matches.push({ position: match.index, value: undefined });
    }
  }

  matches.sort((a, b) => a.position - b.position);
  return matches.at(-1);
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

function defaultPropertyValue(
  detail: UdcDetail,
  propertyNames: string[]
): string | boolean | undefined {
  for (const propertyName of propertyNames) {
    const raw = detail.properties.find((p) => p.property_name === propertyName)?.default_value;
    if (raw !== null && raw !== undefined) return parseLiteralValue(raw);
  }
  return undefined;
}

function parseLiteralValue(raw: string): string | boolean {
  if (raw === "true" || raw === "false") return raw === "true";
  return raw;
}

function instancePropertyValue(
  detail: UdcDetail,
  clxContent: string,
  instance: UdcInstance,
  propertyNames: string[],
  setterNames: string[] = []
): string | boolean | undefined {
  for (const propertyName of propertyNames) {
    const override = findInstanceOverrideResult(
      clxContent,
      instance,
      propertyName,
      setterNames
    );
    if (override) return override.value;
  }
  return defaultPropertyValue(detail, propertyNames);
}

/**
 * 파일 업로드 UDC는 아이콘 버튼의 text가 비어 있고 버튼 문구가 app property에
 * 보관되므로, 컨트롤 default_label 대신 *ButtonText/*ButtonVisible 쌍으로 액션을 만든다.
 */
function resolveFileUploadInstanceActions(
  detail: UdcDetail,
  clxContent: string,
  instance?: UdcInstance
): ResolvedUdcAction[] {
  const controls = new Map(detail.controls.map((control) => [control.control_id, control]));
  const actions: ResolvedUdcAction[] = [];
  const valueFor = (propertyNames: string[], setterNames: string[] = []) => instance
    ? instancePropertyValue(detail, clxContent, instance, propertyNames, setterNames)
    : defaultPropertyValue(detail, propertyNames);

  for (const spec of FILE_UPLOAD_ACTION_SPECS) {
    const control = controls.get(spec.controlId);
    const rawLabel = valueFor(spec.labelProperties, spec.labelSetterNames);
    const fallbackLabel = control?.default_label?.trim() ?? "";
    const label = typeof rawLabel === "string" && rawLabel.trim()
      ? rawLabel.trim()
      : fallbackLabel;
    if (!label) continue;

    const reasons: string[] = [];
    let visibility: ResolvedVisibility;
    if (spec.singleUploadOnly) {
      const isMultiUpload = valueFor(["isMultiUpload"], ["setIsMultiUpload"]);
      reasons.push(`isMultiUpload=${String(isMultiUpload)}`);
      if (isMultiUpload === true) visibility = "hidden";
      else if (isMultiUpload !== false) visibility = "unknown";
      else visibility = "visible";
    } else {
      visibility = "visible";
    }

    if (visibility === "visible") {
      const visible = valueFor([spec.visibleProperty], spec.visibleSetterNames);
      reasons.push(`${spec.visibleProperty}=${String(visible)}`);
      visibility = visible === true ? "visible" : visible === false ? "hidden" : "unknown";
    }

    actions.push({
      controlId: spec.controlId,
      actionType: control?.action_type ?? null,
      actionTarget: control?.action_target ?? null,
      label,
      visibility,
      visibilityReasons: reasons,
    });
  }

  return actions;
}

function mergeVisibleActions(actionsByInstance: ResolvedUdcAction[][]): ResolvedUdcInfo["actions"] {
  const result: ResolvedUdcInfo["actions"] = [];
  const seen = new Set<string>();
  for (const actions of actionsByInstance) {
    for (const action of actions) {
      if (action.visibility !== "visible" || !action.label) continue;
      const key = `${action.controlId}\0${action.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(action);
    }
  }
  const order = new Map(FILE_UPLOAD_ACTION_SPECS.map((spec, index) => [spec.controlId, index]));
  return result.sort((a, b) =>
    (order.get(a.controlId) ?? Number.MAX_SAFE_INTEGER) -
    (order.get(b.controlId) ?? Number.MAX_SAFE_INTEGER)
  );
}

function resolveControlActions(detail: UdcDetail): ResolvedUdcInfo["actions"] {
  return detail.controls
    .filter((c) => c.control_type === "button" && (c.action_type || c.default_label))
    .map((c) => ({
      controlId: c.control_id,
      actionType: c.action_type,
      actionTarget: c.action_target,
      label: c.default_label,
    }));
}

function resolveInstanceLabels(
  detail: UdcDetail,
  instance: UdcInstance,
  calls: UdcFunctionCall[],
  visibleOverrides: VisibleOverride[]
): LabelResolution[] {
  const labels = baseLabels(detail).map((label) => ({ ...label }));
  const properties = new Map(detail.properties.map((property) => [property.property_name, property]));
  const visibility = new Map<string, boolean>();

  for (const call of calls.filter((item) => item.instanceId === instance.instanceId)) {
    const fn = detail.functions.find((item) => item.function_name === call.functionName);
    if (!fn) continue;

    for (const target of fn.target_controls ?? []) {
      const parameterPosition = target.parameter_position ?? 0;
      const value = call.args[parameterPosition];
      if (target.attribute === "visible" && typeof value === "boolean") {
        visibility.set(target.control_id, value);
      } else if ((target.attribute === "text" || target.attribute === "value") && typeof value === "string") {
        const label = labels.find((item) => item.targetControlId === target.control_id);
        if (label) {
          label.resolvedLabel = value;
          label.functionName = call.functionName;
        }
      }
    }

    // Backward-compatible fallback for existing single-property label metadata.
    if (fn.function_type === "set_label" && typeof call.args[0] === "string" && (fn.target_controls?.length ?? 0) === 0) {
      const propertyName = fn.target_properties[0];
      const property = propertyName ? properties.get(propertyName) : undefined;
      const label = property?.target_control_id
        ? labels.find((item) => item.targetControlId === property.target_control_id)
        : undefined;
      if (label) {
        label.resolvedLabel = call.args[0];
        label.functionName = call.functionName;
      }
    }
  }

  const propertyFiltered = applyVisibleFilter(
    detail,
    visibleOverrides.filter((item) => item.instanceId === instance.instanceId),
    labels
  );
  return propertyFiltered.filter((label) => visibility.get(label.targetControlId ?? "") !== false);
}

function mergeResolvedLabels(instances: ResolvedUdcInfo["instances"]): LabelResolution[] {
  const result: LabelResolution[] = [];
  const seen = new Set<string>();
  for (const instance of instances) {
    for (const label of instance.resolvedLabels) {
      const key = `${label.targetControlId ?? ""}\0${label.resolvedLabel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}

/**
 * 단일 UDC 의 최종 매뉴얼 보강 정보를 해석한다.
 */
export function resolveUdc(
  detail: UdcDetail,
  clxContent: string,
  isInstanceVisible: (instanceId: string) => boolean = () => true,
): ResolvedUdcInfo {
  const discoveredInstances = findUdcInstances(clxContent, detail.component.short_name);
  const instances = discoveredInstances.filter((instance) => isInstanceVisible(instance.instanceId));
  const functionCalls = extractInstanceFunctionCalls(clxContent, instances);
  const visibleOverrides = extractVisibleOverrides(clxContent);
  const isFileUpload = detail.component.component_type === "file_upload";
  const resolvedInstances = instances.map((instance) => {
    const explicitTitle = isFileUpload
      ? findInstanceOverride(clxContent, instance, "titleText", ["setTitleText"])
      : undefined;
    return {
      instanceId: instance.instanceId,
      resolvedLabels: resolveInstanceLabels(detail, instance, functionCalls, visibleOverrides),
      ...(isFileUpload ? { actions: resolveFileUploadInstanceActions(detail, clxContent, instance) } : {}),
      ...(typeof explicitTitle === "string" && explicitTitle.trim()
        ? { explicitTitle: explicitTitle.trim() }
        : {}),
    };
  });
  const resolvedLabels = resolvedInstances.length > 0
    ? mergeResolvedLabels(resolvedInstances)
    : discoveredInstances.length > 0
      ? []
    : applyVisibleFilter(
        detail,
        visibleOverrides,
        applyOverrides(detail, extractSetterCalls(clxContent), baseLabels(detail))
      );

  const gridColumns =
    detail.controls.find((c) => c.control_type === "grid")?.grid_columns ?? [];

  const cascade =
    detail.controls.find((c) => c.cascade_config !== null)?.cascade_config ?? null;

  const actions = isFileUpload
    ? mergeVisibleActions(
        resolvedInstances.length > 0
          ? resolvedInstances.map((instance) => instance.actions ?? [])
          : discoveredInstances.length > 0
            ? []
            : [resolveFileUploadInstanceActions(detail, clxContent)]
      )
    : resolveControlActions(detail);

  return {
    shortName: detail.component.short_name,
    qualifiedName: detail.component.qualified_name,
    displayName: detail.component.display_name,
    componentType: detail.component.component_type,
    description: detail.component.description,
    sectionUsage: detail.component.section_usage,
    resolvedLabels,
    instances: resolvedInstances,
    gridColumns: gridColumns ?? [],
    cascade,
    actions,
  };
}
