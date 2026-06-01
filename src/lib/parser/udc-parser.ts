/**
 * UDC 파서 — eXBuilder6 컴파일 udc.js 를 파싱하여 구조화된 메타데이터 추출
 *
 * udc.js 구조:
 *  - `/// start - <qualifiedName>` 로 컴포넌트 블록 분리
 *  - 헤더 주석: [분류] [컴포넌트명] [설명] [작성자명] [작성일자] [버전]
 *  - `function NAME(...)` + JSDoc(@desc/@param/@example)
 *  - `exports.NAME = fn;` (노출 함수)
 *  - `app.declareAppProperty("name", default)` (프로퍼티)
 *  - `new cpr.controls.Output("T_S_YR")` + `.value="연도"` (UI 컨트롤)
 *  - `.setItemSet(app.lookup("ds_..."), {label, value})` (데이터셋 바인딩)
 *
 * 6-Pass 설계:
 *  Pass 1 — 블록 분리 + 메타데이터(헤더/타입 분류)
 *  Pass 2 — 노출 함수 + JSDoc
 *  Pass 3 — UI 컨트롤 (핵심 5타입만)
 *  Pass 4 — 프로퍼티 + Control 매핑 (핵심 5타입만)
 *  Pass 5 — 데이터셋 바인딩 (핵심 5타입만)
 *  Pass 6 — 관계 구성 (function→property→control, grid_columns, cascade)
 */
import { createHash } from "crypto";
import type {
  ParsedUdc,
  ParsedControl,
  ParsedProperty,
  ParsedFunction,
  ParsedDataset,
  UdcParseResult,
  UdcComponentType,
  UdcCategory,
  UdcControlType,
  UdcPropertyGroup,
  UdcDataType,
  UdcFunctionType,
  UdcFunctionParam,
  UdcGridColumn,
  UdcCascadeConfig,
} from "@/types";

/** 전체 파싱 대상 타입 (Pass 3~6 까지 수행) */
const CORE_TYPES: ReadonlySet<UdcComponentType> = new Set([
  "combo",
  "cascading_combo",
  "grid",
  "info",
  "file_upload",
]);

// ============================================================
// 진입점
// ============================================================

/** udc.js 전체를 파싱하여 모든 UDC 컴포넌트 정보를 반환 */
export function parseUdcFile(fileName: string, content: string): UdcParseResult {
  const fileHash = sha1(content);
  const blocks = splitBlocks(content);
  const udcs: ParsedUdc[] = [];

  for (const block of blocks) {
    const parsed = parseBlock(block.qualifiedName, block.body);
    if (parsed) udcs.push(parsed);
  }

  return { fileName, fileHash, udcs };
}

// ============================================================
// Pass 1 — 블록 분리 + 메타데이터
// ============================================================

interface RawBlock {
  qualifiedName: string;
  body: string;
}

function splitBlocks(content: string): RawBlock[] {
  const parts = content.split("/// start - ");
  parts.shift(); // 첫 조각은 헤더/공통 코드
  const blocks: RawBlock[] = [];
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const qualifiedName = part.slice(0, nl).trim();
    if (!qualifiedName.startsWith("udc.")) continue;
    blocks.push({ qualifiedName, body: part });
  }
  return blocks;
}

interface HeaderMeta {
  displayName: string;
  category: UdcCategory;
  author: string | null;
  version: string | null;
  description: string | null;
}

const CATEGORY_KEYWORDS: { keyword: string; category: UdcCategory }[] = [
  { keyword: "학부", category: "학사" },
  { keyword: "학사", category: "학사" },
  { keyword: "행정", category: "행정" },
  { keyword: "연구", category: "연구" },
  { keyword: "부속", category: "부속" },
  { keyword: "공통", category: "공통" },
];

function parseHeaderMeta(body: string, qualifiedName: string): HeaderMeta {
  const grab = (label: string): string | null => {
    const re = new RegExp(`\\[${label}\\]\\s*(.+)`);
    const m = re.exec(body);
    return m ? m[1].trim() : null;
  };

  const classify = grab("분류");
  const desc = grab("설명");
  const author = grab("작성자명");
  const version = grab("버전");

  // internalApp.title = "..." 를 displayName 후보로 사용
  const titleMatch = /internalApp\.title\s*=\s*"([^"]+)"/.exec(body);
  const shortName = qualifiedName.split(".").pop() ?? qualifiedName;
  const displayName = desc ?? titleMatch?.[1] ?? shortName;

  // 카테고리 판정: [분류] 우선, 없으면 qualifiedName 의 패키지로 추정
  let category: UdcCategory = "기타";
  const haystack = `${classify ?? ""} ${qualifiedName}`;
  for (const { keyword, category: cat } of CATEGORY_KEYWORDS) {
    if (haystack.includes(keyword)) {
      category = cat;
      break;
    }
  }
  if (category === "기타") {
    if (qualifiedName.includes(".univ.")) category = "학사";
    else if (qualifiedName.includes(".admin.")) category = "행정";
    else if (qualifiedName.includes(".common.")) category = "공통";
  }

  return {
    displayName,
    category,
    author,
    version,
    description: desc,
  };
}

// ============================================================
// Pass 3 — UI 컨트롤 추출
// ============================================================

interface RawControl {
  controlId: string;
  cprType: string;
  controlType: UdcControlType;
  isLabel: boolean;
  defaultLabel: string | null;
  displayOrder: number;
}

/** cpr.controls.<Type> → 내부 control_type 매핑 */
function mapControlType(cprType: string, controlId: string): UdcControlType {
  switch (cprType) {
    case "Output":
      return controlId.startsWith("T_") ? "label" : "output";
    case "ComboBox":
      return "combo";
    case "NumberEditor":
    case "InputBox":
    case "MaskEditor":
    case "DateEditor":
    case "Calendar":
    case "TextArea":
      return "input";
    case "Button":
      return "button";
    case "Grid":
      return "grid";
    case "Container":
      return "group";
    default:
      return "output";
  }
}

function parseControls(body: string): RawControl[] {
  const controls: RawControl[] = [];
  // new cpr.controls.<Type>("ID")  (그리드는 new cpr.controls.grid... 형태도 포착)
  const re = /new\s+cpr\.controls\.(?:grids\.)?(\w+)\s*\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  let order = 0;
  const seen = new Set<string>();
  while ((m = re.exec(body)) !== null) {
    const cprType = m[1];
    const controlId = m[2];
    if (seen.has(controlId)) continue;
    seen.add(controlId);

    const controlType = mapControlType(cprType, controlId);
    const isLabel = controlType === "label";

    // 라벨/값 기본 텍스트: 선언 직후 .value = "..." 또는 .text = "..."
    let defaultLabel: string | null = null;
    const after = body.slice(m.index, m.index + 600);
    const valM = /\.(?:value|text)\s*=\s*"([^"]+)"/.exec(after);
    if (valM) defaultLabel = valM[1];

    controls.push({
      controlId,
      cprType,
      controlType,
      isLabel,
      defaultLabel,
      displayOrder: order++,
    });
  }
  return controls;
}

// ============================================================
// Pass 4 — 프로퍼티 추출
// ============================================================

interface RawProperty {
  name: string;
  group: UdcPropertyGroup;
  defaultValue: string | null;
  dataType: UdcDataType;
}

function classifyPropertyGroup(name: string): UdcPropertyGroup {
  const lower = name.toLowerCase();
  if (lower.endsWith("labelwidth") || lower.endsWith("width")) return "width";
  if (lower.endsWith("label")) return "label";
  if (lower.endsWith("visible")) return "visible";
  if (lower.endsWith("enable")) return "enable";
  if (lower.includes("headtype")) return "headType";
  if (lower.includes("filter")) return "filter";
  if (lower.endsWith("value")) return "value";
  return "bind";
}

function inferDataType(raw: string | null): { type: UdcDataType; value: string | null } {
  if (raw === null) return { type: "string", value: null };
  const trimmed = raw.trim();
  if (trimmed === "null") return { type: "string", value: null };
  if (trimmed === "true" || trimmed === "false") return { type: "boolean", value: trimmed };
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { type: "number", value: trimmed };
  // 따옴표 제거
  const str = trimmed.replace(/^["']|["']$/g, "");
  return { type: "string", value: str };
}

function parseProperties(body: string): RawProperty[] {
  const props: RawProperty[] = [];
  const seen = new Set<string>();
  // app.declareAppProperty("name", default)
  const re = /app\.declareAppProperty\(\s*"([^"]+)"\s*,\s*([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const { type, value } = inferDataType(m[2]);
    props.push({
      name,
      group: classifyPropertyGroup(name),
      defaultValue: value,
      dataType: type,
    });
  }
  return props;
}

// ============================================================
// Pass 2 — 노출 함수 + JSDoc
// ============================================================

interface RawFunction {
  name: string;
  type: UdcFunctionType;
  parameters: UdcFunctionParam[];
  description: string | null;
}

function classifyFunctionType(name: string): UdcFunctionType {
  if (/^init/.test(name)) return "init";
  if (/^get/.test(name)) return "get";
  if (/event/i.test(name)) return "event";
  if (/Label$/i.test(name)) return "set_label";
  if (/Visible$/i.test(name)) return "set_visible";
  if (/Enable$/i.test(name)) return "set_enable";
  if (/Width$/i.test(name)) return "set_width";
  return "event";
}

/** JSDoc @desc / @param 추출 (함수 정의 위치 기준) */
function extractJsDoc(
  body: string,
  funcName: string
): { description: string | null; params: UdcFunctionParam[] } {
  const re = new RegExp(`@function\\s+${funcName}\\b([\\s\\S]{0,1200}?)(?:\\*{3,}|@function)`, "");
  const m = re.exec(body);
  if (!m) return { description: null, params: [] };
  const doc = m[1];

  const descM = /@desc\s+(.+)/.exec(doc);
  const description = descM ? descM[1].trim() : null;

  const params: UdcFunctionParam[] = [];
  const paramRe = /@param\s+(\w+)\s*\{([^}]*)\}\s*(.*)/g;
  let pm: RegExpExecArray | null;
  let pos = 0;
  while ((pm = paramRe.exec(doc)) !== null) {
    params.push({
      name: pm[1],
      type: pm[2].trim() || "any",
      description: pm[3].trim() || undefined,
      position: pos++,
    });
  }
  return { description, params };
}

function parseFunctions(body: string): RawFunction[] {
  const funcs: RawFunction[] = [];
  const seen = new Set<string>();
  // exports.NAME = something;
  const re = /exports\.(\w+)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const { description, params } = extractJsDoc(body, name);
    funcs.push({
      name,
      type: classifyFunctionType(name),
      parameters: params,
      description,
    });
  }
  return funcs;
}

// ============================================================
// Pass 5 — 데이터셋 바인딩
// ============================================================

interface RawDataset {
  name: string;
  boundControlId: string | null;
  codeColumn: string | null;
  nameColumn: string | null;
}

function parseDatasets(body: string, controls: RawControl[]): RawDataset[] {
  const datasets = new Map<string, RawDataset>();

  // combo.setItemSet(app.lookup("ds_xxx"), { "label": "DATA", "value": "CODE" })
  const re =
    /(\w+)\.setItemSet\(\s*app\.lookup\("([^"]+)"\)\s*,\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const varName = m[1];
    const dsName = m[2];
    const opts = m[3];
    const labelM = /"label"\s*:\s*"([^"]+)"/.exec(opts);
    const valueM = /"value"\s*:\s*"([^"]+)"/.exec(opts);

    // varName(comboBox_1) → 직전 선언된 컨트롤 id 매핑은 어려우므로 dataset만 기록
    datasets.set(dsName, {
      name: dsName,
      boundControlId: guessBoundControl(varName, body, controls),
      codeColumn: valueM ? valueM[1] : null,
      nameColumn: labelM ? labelM[1] : null,
    });
  }

  // app.lookup("ds_xxx") 만 단독 등장하는 데이터셋도 수집
  const lookupRe = /app\.lookup\("(ds_\w+)"\)/g;
  while ((m = lookupRe.exec(body)) !== null) {
    if (!datasets.has(m[1])) {
      datasets.set(m[1], {
        name: m[1],
        boundControlId: null,
        codeColumn: null,
        nameColumn: null,
      });
    }
  }

  return [...datasets.values()];
}

/** `var comboBox_1 = new cpr.controls.ComboBox("S_SMSTR_SE")` → control id 역추적 */
function guessBoundControl(
  varName: string,
  body: string,
  controls: RawControl[]
): string | null {
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*new\\s+cpr\\.controls\\.\\w+\\("([^"]+)"\\)`);
  const m = re.exec(body);
  if (m) return m[1];
  // fallback: 첫 combo 컨트롤
  const combo = controls.find((c) => c.controlType === "combo");
  return combo ? combo.controlId : null;
}

// ============================================================
// Pass 1.5 — 컴포넌트 타입 분류
// ============================================================

function classifyComponentType(
  qualifiedName: string,
  controls: RawControl[]
): UdcComponentType {
  const shortName = qualifiedName.split(".").pop() ?? "";
  const combos = controls.filter((c) => c.controlType === "combo");
  const buttons = controls.filter((c) => c.controlType === "button");
  const grids = controls.filter((c) => c.controlType === "grid");

  if (grids.length > 0 || /BtchList|Grid/i.test(shortName)) return "grid";
  if (/FileUpload|FileToList|Upload/i.test(shortName)) return "file_upload";
  if (combos.length >= 2) return "cascading_combo";
  if (combos.length === 1) return "combo";
  if (/Link|Groupware|Grpwr/i.test(shortName)) return "button_bar";
  // 정보 표시형(Info/Comnt/Comp) 은 내부 버튼이 있어도 info 로 분류한다.
  // (버튼 우선 분류보다 앞에 두어 학생정보처럼 필드+버튼 혼합 UDC 가 button_bar 로
  //  잘못 분류되어 컨트롤이 누락되는 것을 방지)
  if (/Comnt|Comp|Info/i.test(shortName) && controls.some((c) => c.controlType === "output"))
    return "info";
  if (buttons.length >= 2) return "button_bar";
  return "utility";
}

// ============================================================
// Pass 6 — 관계 구성 + ParsedUdc 빌드
// ============================================================

/** 라벨 프로퍼티 → 라벨 컨트롤 매핑 (기본값 텍스트 일치 기반) */
function mapPropertyToControl(
  prop: RawProperty,
  controls: RawControl[]
): { controlId: string | null; attribute: string | null } {
  if (prop.group === "label" && prop.defaultValue) {
    const match = controls.find(
      (c) => c.isLabel && c.defaultLabel === prop.defaultValue
    );
    if (match) return { controlId: match.controlId, attribute: "text" };
  }
  // 이름 기반 추정: yrLabel → T_*YR* 형태는 신뢰도 낮아 생략
  const attrByGroup: Record<UdcPropertyGroup, string | null> = {
    label: "text",
    width: "width",
    visible: "visible",
    enable: "enabled",
    value: "value",
    filter: null,
    headType: null,
    bind: null,
  };
  return { controlId: null, attribute: attrByGroup[prop.group] };
}

/** set/init 함수 → 프로퍼티 매핑 (setYrLabel → yrLabel) */
function mapFunctionToProperties(
  func: RawFunction,
  props: RawProperty[]
): string[] {
  const m = /^(?:set|init)(.+)$/.exec(func.name);
  if (!m) return [];
  const base = m[1];
  const candidate = base.charAt(0).toLowerCase() + base.slice(1);
  const hit = props.find((p) => p.name === candidate);
  return hit ? [hit.name] : [];
}

/** 캐스케이드 설정 구성 (cascading_combo) */
function buildCascadeConfig(controls: RawControl[]): UdcCascadeConfig | null {
  const combos = controls.filter((c) => c.controlType === "combo");
  if (combos.length < 2) return null;
  // 선언 순서상 앞 콤보가 뒤 콤보를 트리거한다고 가정 (대학→학과→전공)
  return {
    triggeredBy: combos[0].controlId,
    paramMapping: combos.slice(1).map((c, i) => ({
      from: combos[i].controlId,
      to: c.controlId,
    })),
  };
}

function parseBlock(qualifiedName: string, body: string): ParsedUdc | null {
  const shortName = qualifiedName.split(".").pop();
  if (!shortName) return null;

  const meta = parseHeaderMeta(body, qualifiedName);
  const rawControls = parseControls(body);
  const componentType = classifyComponentType(qualifiedName, rawControls);
  const isCore = CORE_TYPES.has(componentType);

  // 사용 섹션 추론
  const sectionUsage = inferSectionUsage(componentType);

  const component = {
    short_name: shortName,
    qualified_name: qualifiedName,
    display_name: meta.displayName,
    component_type: componentType,
    category: meta.category,
    description: meta.description,
    author: meta.author,
    version: meta.version,
    section_usage: sectionUsage,
    source_hash: sha1(body),
    raw_metadata: null,
  };

  // 함수는 모든 타입에서 추출 (Pass 2)
  const rawFunctions = parseFunctions(body);

  if (!isCore) {
    // 비핵심 타입: 메타데이터 + 함수만
    return {
      component,
      controls: [],
      properties: [],
      functions: rawFunctions.map((f) => toFunctionInsert(f, [])),
      datasets: [],
    };
  }

  // 핵심 타입: Pass 3~6 전체 수행
  const rawProps = parseProperties(body);
  const rawDatasets = parseDatasets(body, rawControls);

  const controls: ParsedControl[] = buildControls(
    rawControls,
    componentType,
    body
  );
  const properties: ParsedProperty[] = rawProps.map((p) => {
    const { controlId, attribute } = mapPropertyToControl(p, rawControls);
    return {
      property_name: p.name,
      property_group: p.group,
      default_value: p.defaultValue,
      data_type: p.dataType,
      target_control_id: controlId,
      target_attribute: attribute,
    };
  });
  const functions: ParsedFunction[] = rawFunctions.map((f) =>
    toFunctionInsert(f, mapFunctionToProperties(f, rawProps))
  );
  const datasets: ParsedDataset[] = rawDatasets.map((d) => ({
    dataset_name: d.name,
    bound_control_id: d.boundControlId,
    code_column: d.codeColumn,
    name_column: d.nameColumn,
    service_url: null,
  }));

  return { component, controls, properties, functions, datasets };
}

function toFunctionInsert(f: RawFunction, targetProps: string[]): ParsedFunction {
  return {
    function_name: f.name,
    function_type: f.type,
    parameters: f.parameters,
    target_properties: targetProps,
    target_controls: [],
    is_exported: true,
    description: f.description,
  };
}

/** 컨트롤 → ParsedControl (라벨 쌍, 캐스케이드, 그리드 컬럼 반영) */
function buildControls(
  rawControls: RawControl[],
  componentType: UdcComponentType,
  body: string
): ParsedControl[] {
  const cascade =
    componentType === "cascading_combo" ? buildCascadeConfig(rawControls) : null;

  return rawControls.map((c) => {
    // 라벨↔입력 쌍: T_S_YR ↔ S_YR
    let paired: string | null = null;
    if (c.isLabel) {
      const baseId = c.controlId.replace(/^T_/, "");
      const partner = rawControls.find(
        (o) => !o.isLabel && (o.controlId === baseId || o.controlId === `S_${baseId}`)
      );
      paired = partner ? partner.controlId : null;
    }

    const gridColumns =
      c.controlType === "grid" ? parseGridColumns(body, c.controlId) : null;

    const cascadeConfig =
      componentType === "cascading_combo" && c.controlType === "combo" && cascade
        ? cascade
        : null;

    const action = c.controlType === "button" ? parseButtonAction(body, c.controlId) : null;

    return {
      control_id: c.controlId,
      control_type: c.controlType,
      default_label: c.defaultLabel,
      bind_dataset: null,
      display_order: c.displayOrder,
      is_label_control: c.isLabel,
      paired_control_id: paired,
      action_type: action?.actionType ?? null,
      action_target: action?.actionTarget ?? null,
      action_params: action?.actionParams ?? null,
      grid_columns: gridColumns,
      cascade_config: cascadeConfig,
    };
  });
}

/** 그리드 컬럼 정의 추출 */
function parseGridColumns(body: string, gridId: string): UdcGridColumn[] | null {
  const columns: UdcGridColumn[] = [];
  // .setColumns([{ "name": "...", "head": ... }]) 또는 addColumn 패턴 — 보수적으로 head/dataField 추출
  const re = /columnName\s*:\s*"([^"]+)"[^}]*?(?:head|header)\w*\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(body)) !== null) {
    columns.push({ columnName: m[1], header: m[2], index: idx++ });
  }
  return columns.length > 0 ? columns : null;
}

/** 버튼 동작 추출 (팝업/서비스/함수) */
function parseButtonAction(
  body: string,
  buttonId: string
): {
  actionType: "popup" | "service" | "function" | "confirm";
  actionTarget: string | null;
  actionParams: Record<string, unknown> | null;
} | null {
  // app.lookup("BTN_X").addEventListener("click", function(){ ... })
  const re = new RegExp(
    `lookup\\("${buttonId}"\\)[\\s\\S]{0,400}?(?:openPopup|open|callService|submit|confirm)\\s*\\(\\s*"?([^",)]*)`,
    ""
  );
  const m = re.exec(body);
  if (!m) return null;
  const target = m[1] || null;
  let actionType: "popup" | "service" | "function" | "confirm" = "function";
  const segment = m[0];
  if (/openPopup|open/.test(segment)) actionType = "popup";
  else if (/callService|submit/.test(segment)) actionType = "service";
  else if (/confirm/.test(segment)) actionType = "confirm";
  return { actionType, actionTarget: target, actionParams: null };
}

/** 컴포넌트 타입 → 사용 섹션 추론 */
function inferSectionUsage(type: UdcComponentType): string[] {
  switch (type) {
    case "grid":
      return ["그리드"];
    case "file_upload":
      return ["처리조건"];
    case "button_bar":
      return ["타이틀바", "처리조건"];
    case "info":
      return ["인포영역"];
    case "combo":
    case "cascading_combo":
      return ["조회조건"];
    default:
      return [];
  }
}

// ============================================================
// 유틸
// ============================================================

function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}
