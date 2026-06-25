/**
 * UDC(User Defined Component) 분석 데이터 타입 정의
 *
 * 구성:
 *  1) DB 행 타입 (Row/Insert/Update) — Supabase 테이블 대응
 *  2) 파서 결과 타입 — udc.js 파싱 산출물
 *  3) 라벨 해석/매뉴얼 보강 컨텍스트 타입
 */

// ============================================================
// 0. 공통 enum 유니온
// ============================================================

/** UDC 컴포넌트 유형 */
export type UdcComponentType =
  | "combo"
  | "cascading_combo"
  | "grid"
  | "info"
  | "file_upload"
  | "button_bar"
  | "utility"
  | "editor"
  | "report"
  | "finder";

/** UDC 카테고리 (단어사전 카테고리와 동일) */
export type UdcCategory = "공통" | "학사" | "행정" | "연구" | "부속" | "기타";

/** 내부 컨트롤 유형 */
export type UdcControlType =
  | "label"
  | "combo"
  | "input"
  | "output"
  | "button"
  | "grid"
  | "group"
  | "dataset";

/** 프로퍼티 그룹 */
export type UdcPropertyGroup =
  | "label"
  | "width"
  | "visible"
  | "enable"
  | "value"
  | "filter"
  | "headType"
  | "bind";

/** 프로퍼티 데이터 타입 */
export type UdcDataType = "string" | "boolean" | "number";

/** export 함수 유형 */
export type UdcFunctionType =
  | "init"
  | "set_label"
  | "set_visible"
  | "set_enable"
  | "set_width"
  | "get"
  | "event";

/** 버튼/그리드 동작 유형 */
export type UdcActionType = "popup" | "service" | "function" | "confirm";

// ============================================================
// 1. DB 행 타입
// ============================================================

/** udc_component 테이블 행 */
export interface UdcComponent {
  id: string;
  short_name: string;
  qualified_name: string;
  display_name: string;
  component_type: UdcComponentType;
  category: UdcCategory;
  description: string | null;
  author: string | null;
  version: string | null;
  section_usage: string[];
  source_hash: string | null;
  raw_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UdcComponentInsert {
  short_name: string;
  qualified_name: string;
  display_name: string;
  component_type: UdcComponentType;
  category: UdcCategory;
  description?: string | null;
  author?: string | null;
  version?: string | null;
  section_usage?: string[];
  source_hash?: string | null;
  raw_metadata?: Record<string, unknown> | null;
}

export interface UdcComponentUpdate {
  qualified_name?: string;
  display_name?: string;
  component_type?: UdcComponentType;
  category?: UdcCategory;
  description?: string | null;
  author?: string | null;
  version?: string | null;
  section_usage?: string[];
  source_hash?: string | null;
  raw_metadata?: Record<string, unknown> | null;
  updated_at?: string;
}

/** 그리드 컬럼 정의 (udc_control.grid_columns) */
export interface UdcGridColumn {
  header: string;
  columnName: string;
  width?: number;
  index?: number;
}

/** 캐스케이드 설정 (udc_control.cascade_config) */
export interface UdcCascadeConfig {
  triggeredBy: string;
  reloadMethod?: string;
  paramMapping: { from: string; to: string }[];
}

/** udc_control 테이블 행 */
export interface UdcControl {
  id: string;
  udc_id: string;
  control_id: string;
  control_type: UdcControlType;
  default_label: string | null;
  bind_dataset: string | null;
  display_order: number;
  is_label_control: boolean;
  paired_control_id: string | null;
  action_type: UdcActionType | null;
  action_target: string | null;
  action_params: Record<string, unknown> | null;
  grid_columns: UdcGridColumn[] | null;
  cascade_config: UdcCascadeConfig | null;
}

export interface UdcControlInsert {
  udc_id: string;
  control_id: string;
  control_type: UdcControlType;
  default_label?: string | null;
  bind_dataset?: string | null;
  display_order?: number;
  is_label_control?: boolean;
  paired_control_id?: string | null;
  action_type?: UdcActionType | null;
  action_target?: string | null;
  action_params?: Record<string, unknown> | null;
  grid_columns?: UdcGridColumn[] | null;
  cascade_config?: UdcCascadeConfig | null;
}

/** udc_property 테이블 행 */
export interface UdcProperty {
  id: string;
  udc_id: string;
  property_name: string;
  property_group: UdcPropertyGroup;
  default_value: string | null;
  data_type: UdcDataType;
  target_control_id: string | null;
  target_attribute: string | null;
}

export interface UdcPropertyInsert {
  udc_id: string;
  property_name: string;
  property_group: UdcPropertyGroup;
  default_value?: string | null;
  data_type: UdcDataType;
  target_control_id?: string | null;
  target_attribute?: string | null;
}

/** 함수 파라미터 정의 (udc_function.parameters) */
export interface UdcFunctionParam {
  name: string;
  type: string;
  description?: string;
  position: number;
}

/** 함수 → 컨트롤 매핑 (udc_function.target_controls) */
export interface UdcFunctionTargetControl {
  control_id: string;
  attribute: string;
}

/** udc_function 테이블 행 */
export interface UdcFunction {
  id: string;
  udc_id: string;
  function_name: string;
  function_type: UdcFunctionType;
  parameters: UdcFunctionParam[];
  target_properties: string[];
  target_controls: UdcFunctionTargetControl[];
  is_exported: boolean;
  description: string | null;
}

export interface UdcFunctionInsert {
  udc_id: string;
  function_name: string;
  function_type: UdcFunctionType;
  parameters?: UdcFunctionParam[];
  target_properties?: string[];
  target_controls?: UdcFunctionTargetControl[];
  is_exported?: boolean;
  description?: string | null;
}

/** udc_dataset 테이블 행 */
export interface UdcDataset {
  id: string;
  udc_id: string;
  dataset_name: string;
  bound_control_id: string | null;
  code_column: string | null;
  name_column: string | null;
  service_url: string | null;
}

export interface UdcDatasetInsert {
  udc_id: string;
  dataset_name: string;
  bound_control_id?: string | null;
  code_column?: string | null;
  name_column?: string | null;
  service_url?: string | null;
}

/** udc_upload_log 테이블 행 */
export interface UdcUploadLog {
  id: string;
  file_name: string;
  file_hash: string;
  component_count: number;
  upserted_count: number;
  unchanged_count: number;
  uploaded_at: string;
}

export interface UdcUploadLogInsert {
  file_name: string;
  file_hash: string;
  component_count?: number;
  upserted_count?: number;
  unchanged_count?: number;
}

// ============================================================
// 2. 파서 결과 타입 (udc.js 파싱 산출물 — DB id 없음)
// ============================================================

/** 파싱된 컨트롤 (DB udc_control 의 udc_id·id 제외) */
export type ParsedControl = Omit<UdcControlInsert, "udc_id">;

/** 파싱된 프로퍼티 */
export type ParsedProperty = Omit<UdcPropertyInsert, "udc_id">;

/** 파싱된 함수 */
export type ParsedFunction = Omit<UdcFunctionInsert, "udc_id">;

/** 파싱된 데이터셋 */
export type ParsedDataset = Omit<UdcDatasetInsert, "udc_id">;

/** 단일 UDC 파싱 결과 — 컴포넌트 + 하위 엔티티 */
export interface ParsedUdc {
  component: UdcComponentInsert;
  controls: ParsedControl[];
  properties: ParsedProperty[];
  functions: ParsedFunction[];
  datasets: ParsedDataset[];
}

/** udc.js 전체 파싱 결과 */
export interface UdcParseResult {
  fileName: string;
  fileHash: string;
  udcs: ParsedUdc[];
}

// ============================================================
// 3. 라벨 해석 / 매뉴얼 보강 컨텍스트
// ============================================================

/** 라벨 오버라이드 해석 결과 (CLX setter 호출 → 실제 라벨) */
export interface LabelResolution {
  /** UDC 단축명 */
  shortName: string;
  /** 호출된 setter 함수명 (setAcntgYrLabel) */
  functionName: string;
  /** 전달된 라벨 값 ("재정연도") */
  resolvedLabel: string;
  /** 영향 받은 컨트롤 ID (T_ACNTG_YR) */
  targetControlId: string | null;
  /** 기본 라벨 ("회계년도") */
  defaultLabel: string | null;
}

/** 단일 UDC 의 매뉴얼 보강 정보 */
export interface ResolvedUdcInfo {
  shortName: string;
  qualifiedName: string;
  displayName: string;
  componentType: UdcComponentType;
  description: string | null;
  sectionUsage: string[];
  /** 컨트롤별 최종 라벨 (기본값 + CLX 오버라이드 반영) */
  resolvedLabels: LabelResolution[];
  /** 그리드 컬럼 (component_type=grid) */
  gridColumns: UdcGridColumn[];
  /** 캐스케이드 관계 (component_type=cascading_combo) */
  cascade: UdcCascadeConfig | null;
  /** 버튼 동작 목록 */
  actions: {
    controlId: string;
    actionType: UdcActionType | null;
    actionTarget: string | null;
    label: string | null;
  }[];
}

/** CLX 파일에서 추출한 UDC Visible 속성 오버라이드 (속성 할당 + 메서드 호출) */
export interface VisibleOverride {
  /** UDC 인스턴스 ID (S_ACNTG_COMBO) */
  instanceId: string;
  /** 프로퍼티명 (bplcCdVisible) */
  propertyName: string;
  /** visible 값 */
  visible: boolean;
}

/** 파일 단위 UDC 보강 컨텍스트 (AI 프롬프트 주입용) */
export interface UdcEnrichmentContext {
  /** 해석된 UDC 목록 */
  udcs: ResolvedUdcInfo[];
  /** UDC DB 조회 성공 여부 (false 시 graceful degradation) */
  available: boolean;
}
