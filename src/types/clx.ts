/**
 * CLX 파일 파싱 결과 타입 정의
 * exBuilder6 .clx.js 파일을 정적 분석한 결과
 */

/** 화면개요 */
export interface OverviewInfo {
  systemName: string;
  subSystem: string;
  programName: string;
  description: string;
  author: string;
  createDate: string;
}

/** CRUD 기능 정보 */
export interface CrudInfo {
  hasInquiry: boolean;
  hasNew: boolean;
  hasSave: boolean;
  hasDelete: boolean;
  extButtons: ExtButtonInfo[];
  title?: string;
}

/** 추가 버튼 정보 */
export interface ExtButtonInfo {
  name: string;
  functionName: string;
  index: number;
  description?: string;
  popupUrl?: string;
}

/** 필수값 정보 */
export interface RequiredFieldInfo {
  targetId: string;
  columns: string[];
  texts: string[];
}

/** 검증 로직(Alert 메시지) 정보 */
export interface ValidationInfo {
  functionName: string;
  message: string;
}

/** 그리드 컬럼 정보 */
export interface GridColumnInfo {
  columnName: string;
  headerText: string;
  description: string;
  controlType: string;
  purpose: "표시" | "입력" | "표시 또는 입력";
}

/** 그리드 정보 */
export interface GridInfo {
  gridId: string;
  title: string;
  isBound: boolean;
  hasCheckbox: boolean;
  hasRowNumber: boolean;
  hasState: boolean;
  sortable: boolean;
  columns: GridColumnInfo[];
  skipAiDescriptions?: boolean;
}

/** 조건그룹 내 개별 컨트롤 정보 */
export interface ConditionControlInfo {
  controlId: string;
  labelText: string;
  description: string;
  controlType: string;
  inputType: "입력" | "표시";
}

/** 조건그룹 정보 */
export interface ConditionGroupInfo {
  groupId: string;
  groupType: "조회조건" | "처리조건" | "일괄처리";
  title?: string;
  controls: ConditionControlInfo[];
}

/** INFOGROUP(세부정보 입력 그룹) 정보 */
export interface InfoGroupInfo {
  groupId: string;
  title?: string;
  controls: ConditionControlInfo[];
}

/** 팝업 정보 */
export interface PopupInfo {
  popupId: string;
  popupUrl: string;
  callbackFunction: string;
  width: number;
  height: number;
}

/** 탭페이지(임베디드 앱) 정보 */
export interface TabPageInfo {
  appUri: string;
  calledFrom: string;
  tabLabel?: string;
}

/** CLX 파싱 결과 전체 구조 */
export interface ClxParseResult {
  filePath: string;
  overview: OverviewInfo;
  usage: {
    menuTitleBar: CrudInfo;
    titleBars: CrudInfo[];
    extraButtons: ExtButtonInfo[];
  };
  /** AI 생성 사용방법 텍스트 ({B}기능명{/B} + Step 형식) */
  aiUsageText?: string;
  /** AI 생성 참고사항 설명 (그룹라벨 → 친화적 설명 배열) */
  aiNotesDescriptions?: Map<string, string[]>;
  notes: {
    requiredFields: RequiredFieldInfo[];
    validations: ValidationInfo[];
  };
  items: {
    conditionGroups: ConditionGroupInfo[];
    infoGroups: InfoGroupInfo[];
    grids: GridInfo[];
  };
  tabPages: TabPageInfo[];
  popups: PopupInfo[];
}

/** 파싱 카테고리 타입 */
export type ClxCategory =
  | "overview"
  | "usage"
  | "notes"
  | "items"
  | "tabPages"
  | "popups";
