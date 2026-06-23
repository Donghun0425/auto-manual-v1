/**
 * CLX 파일 파싱 결과 타입 정의
 * exBuilder6 .clx.js 파일을 정적 분석한 결과
 */

/** 화면개요 */
export interface OverviewInfo {
  systemName: string;
  subSystem: string;
  programName: string;
  /** app.title 속성 값 (앱 제목) */
  appTitle: string;
  description: string;
  author: string;
  createDate: string;
}

/** 파일 상단 주석으로 작성한 업무 힌트 */
export interface WorkHintInfo {
  /** [업무흐름] */
  flow: string[];
  /** [필수사항] */
  required: string[];
  /** [주의사항] */
  caution: string[];
}

/** CRUD 기능 정보 */
export interface CrudInfo {
  hasInquiry: boolean;
  hasNew: boolean;
  hasSave: boolean;
  hasDelete: boolean;
  extButtons: ExtButtonInfo[];
  title?: string;
  /** CRUD 작업별 비즈니스 로직 (함수 라이프사이클 정적 분석 결과) */
  operations?: CrudOperationLogic[];
}

/** CRUD 작업 종류 */
export type CrudOperationType = "조회" | "신규" | "저장" | "삭제";

/**
 * CRUD 작업별 비즈니스 로직 정보
 * Click(전처리) → Action(처리) → After(후처리) 함수 라이프사이클을 정적 분석한 결과
 */
export interface CrudOperationLogic {
  /** 작업 종류 */
  operation: CrudOperationType;
  /** 사전조건/가드 (Click 전처리 검증 + 프레임워크 기본 가드) */
  preconditions: string[];
  /** 처리 단계 설명 (Action 시그널 기반: 서버 전송, 확인창, 팝업 등) */
  processNotes: string[];
  /** 수집된 검증 메시지 원문 (Click/Action 본문 alert) */
  validations: string[];
  /** 확인창(confirm) 호출 여부 */
  hasConfirm: boolean;
  /** 서버 트랜잭션 호출 여부 */
  hasServiceCall: boolean;
  /** 팝업 URL (있을 경우) */
  popupUrl?: string;
  /** 필수 입력값 (저장 전용, requiredText) */
  requiredFields?: string[];
  /** 중복 불가 키 조합 (저장 전용, unique1Text) */
  uniqueKeys?: string[];
  /** 완료 메시지 (After의 완료 안내, 분리 보관 — 프롬프트 미노출) */
  completionMessage?: string;
}

/** 추가 버튼 정보 */
export interface ExtButtonInfo {
  name: string;
  functionName: string;
  index: number;
  description?: string;
  popupUrl?: string;
  /** 버튼 클릭 본문(+1단계 위임 함수) 정적 분석 비즈니스 로직 */
  logic?: ExtButtonLogic;
}

/**
 * 추가 버튼 비즈니스 로직 정보
 * 버튼 Click 핸들러 본문과 직접 호출하는 사용자 정의 함수(1단계 위임)를 정적 분석한 결과
 */
export interface ExtButtonLogic {
  /** 사전조건/가드 (alert + return false 근접 → 진행 차단 조건) */
  guards: string[];
  /** 검증 메시지 (그 외 alert 원문) */
  validations: string[];
  /** 확인창 메시지 (confirm("...") 인자 문자열) */
  confirmMessages: string[];
  /** 처리 단계 설명 (시그널 기반: 팝업/서버전송/그리드변경/엑셀/인쇄/체크선택) */
  processNotes: string[];
  /** 확인창(confirm) 호출 여부 */
  hasConfirm: boolean;
  /** 서버 트랜잭션 호출 여부 */
  hasServiceCall: boolean;
  /** 팝업 URL (있을 경우) */
  popupUrl?: string;
  /** 완료 메시지 (완료 안내, 분리 보관 — 프롬프트 미노출) */
  completionMessage?: string;
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
  inputType: "입력" | "표시" | "실행";
  /** 파서가 정적 분석으로 추출한 동작/선택지 힌트 (AI 설명 프롬프트에 주입) */
  logicHint?: string;
  /** true면 사전(dictionary) 조회/저장 대상에서 제외 (화면별 토글 로직 등) */
  skipDictionary?: boolean;
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
  /** 파일 상단 주석의 [업무흐름]/[필수사항]/[주의사항] 힌트 */
  workHints?: WorkHintInfo;
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
  /** 파일에서 사용된 UDC 목록 */
  usedUdcs: UsedUdcInfo[];
}

/** 사용된 UDC 정보 */
export interface UsedUdcInfo {
  /** UDC 단축명 (예: UcoYrSmstrCombo) */
  shortName: string;
  /** UDC 전체 식별자 (예: udc.univ.UcoYrSmstrCombo) */
  qualifiedName: string;
  /** UDC 설명 */
  description: string;
}

/** 파싱 카테고리 타입 */
export type ClxCategory =
  | "overview"
  | "usage"
  | "notes"
  | "items"
  | "tabPages"
  | "popups";
