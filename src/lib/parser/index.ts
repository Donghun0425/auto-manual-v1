/**
 * 메인 파서 모듈
 * - 각 하위 파서를 통합하여 .clx.js 파일의 전체 분석 결과를 반환
 */
import type { ClxParseResult, ExtButtonInfo, GridInfo } from "@/types";
import { parseHeader } from "./headerParser";
import { parseMenuTitleBarCrud, parseTitleBarCrud, parseExtraButtons, extractPopupUrl } from "./crudParser";
import { parseRequiredFields, parseValidations } from "./validationParser";
import { parseGrids } from "./gridParser";
import { parseConditionGroups } from "./conditionGroupParser";
import { parsePopups } from "./popupParser";
import { parseEmbApps } from "./embAppParser";
import { parseInfoGroups } from "./infoGroupParser";

/**
 * UcoBtchList 컨트롤의 타이틀을 추출한다.
 */
function extractUcoBtchListTitle(content: string, controlId: string): string {
  const declRe = new RegExp(
    `var\\s+(\\w+)\\s*=\\s*(?:linker\\.\\w+\\s*=\\s*)?new\\s+udc\\.univ\\.UcoBtchList\\("${controlId}"\\)`,
  );
  const declMatch = declRe.exec(content);
  if (declMatch) {
    const varName = declMatch[1];
    const after = content.slice(declMatch.index, declMatch.index + 400);
    const m = new RegExp(`${varName}\\.titleText\\s*=\\s*"([^"]+)"`).exec(after);
    if (m) return m[1];
  }

  const initRe = new RegExp(
    `app\\.lookup\\("${controlId}"\\)\\.initBtchList\\s*\\([^,]+,\\s*"([^"]+)"`,
  );
  const initMatch = initRe.exec(content);
  if (initMatch) return initMatch[1];

  const setRe = new RegExp(
    `app\\.lookup\\("${controlId}"\\)\\.setTitleText\\s*\\(\\s*"([^"]+)"`,
  );
  const setMatch = setRe.exec(content);
  if (setMatch) return setMatch[1];

  return "배치 리스트";
}

/** UcoBtchList 내장 그리드 고정 컬럼 정의 */
const UCO_BTCH_LIST_GRID_COLUMNS: GridInfo["columns"] = [
  { columnName: "BTCH_SCRN_SE_NM", headerText: "배치업무", description: "배치 업무 화면 구분명", controlType: "Output", purpose: "표시" },
  { columnName: "PRCS_TS", headerText: "처리일자", description: "배치 실행 날짜/시간", controlType: "Output", purpose: "표시" },
  { columnName: "PRCR_ID", headerText: "처리자", description: "배치 실행 담당자 ID", controlType: "Output", purpose: "표시" },
  { columnName: "RMRK", headerText: "비고", description: "배치 처리 결과 메시지", controlType: "Output", purpose: "표시" },
];

/**
 * .clx.js 파일 내용을 분석하여 매뉴얼 생성에 필요한 정보를 추출
 */
export function analyzeFile(filePath: string, content: string): ClxParseResult {
  const conditionGroups = parseConditionGroups(content);
  const grids = parseGrids(content);

  // UcoBtchList가 포함된 경우 내장 고정 그리드를 grids 목록에 추가
  const ucoBtchRe = /new\s+udc\.univ\.UcoBtchList\("([^"]+)"\)/g;
  let bm: RegExpExecArray | null;
  while ((bm = ucoBtchRe.exec(content)) !== null) {
    const controlId = bm[1];
    if (grids.some(g => g.gridId === controlId)) continue;
    const gridTitle = extractUcoBtchListTitle(content, controlId);
    grids.push({
      gridId: controlId,
      title: gridTitle,
      isBound: false,
      hasCheckbox: false,
      hasRowNumber: false,
      hasState: false,
      sortable: true,
      columns: UCO_BTCH_LIST_GRID_COLUMNS,
      skipAiDescriptions: true,
    });
  }

  return {
    filePath,
    overview: parseHeader(content),
    usage: {
      menuTitleBar: parseMenuTitleBarCrud(content),
      titleBars: parseTitleBarCrud(content),
      extraButtons: parseExtraButtons(content),
    },
    notes: {
      requiredFields: parseRequiredFields(content),
      validations: parseValidations(content),
    },
    items: {
      conditionGroups,
      infoGroups: parseInfoGroups(content),
      grids,
    },
    tabPages: parseEmbApps(content),
    popups: parsePopups(content),
  };
}

/**
 * 여러 파일을 일괄 분석
 */
export function analyzeFiles(files: { path: string; content: string }[]): ClxParseResult[] {
  const results = files.map((file) => analyzeFile(file.path, file.content));
  resolvePopupDescriptions(results);
  return results;
}

/**
 * ext 버튼의 popupUrl을 분석 결과 목록과 매칭하여 description 생성
 */
function resolvePopupDescriptions(results: ClxParseResult[]): void {
  const normalizeUrl = (u: string) => u.replace(/\\/g, "/").replace(/\.clx\.js$/i, "");

  const resultMap = new Map<string, ClxParseResult>();
  for (const r of results) {
    resultMap.set(normalizeUrl(r.filePath), r);
  }

  const findPopupResult = (popupUrl: string): ClxParseResult | undefined => {
    const normalizedPopup = normalizeUrl(popupUrl);
    const exact = resultMap.get(normalizedPopup);
    if (exact) return exact;
    for (const [key, val] of resultMap) {
      if (
        key.endsWith("/" + normalizedPopup) || key.endsWith(normalizedPopup) ||
        normalizedPopup.endsWith("/" + key) || normalizedPopup.endsWith(key)
      ) return val;
    }
    return undefined;
  };

  const enhance = (btn: ExtButtonInfo): void => {
    if (!btn.popupUrl) return;
    const popupResult = findPopupResult(btn.popupUrl);
    if (!popupResult) {
      if (!btn.description) {
        btn.description = `Step1. '${btn.name}' 버튼을 클릭하여 팝업 화면을 연다.`;
      }
      return;
    }
    btn.description = generatePopupDescriptionFromResult(btn.name, popupResult);
  };

  for (const result of results) {
    for (const btn of result.usage.menuTitleBar.extButtons) enhance(btn);
    for (const tb of result.usage.titleBars) {
      for (const btn of tb.extButtons) enhance(btn);
    }
    for (const btn of result.usage.extraButtons) enhance(btn);
  }
}

function generatePopupDescriptionFromResult(btnName: string, popupResult: ClxParseResult): string {
  const steps: string[] = [];
  steps.push(`Step1. '${btnName}' 버튼을 클릭하여 팝업 화면을 연다.`);

  const menu = popupResult.usage.menuTitleBar;
  const titleBars = popupResult.usage.titleBars;

  const menuHasCrud = menu.hasInquiry || menu.hasNew || menu.hasSave || menu.hasDelete;
  const titleBarsWithCrud = titleBars.filter(
    (tb) => tb.hasInquiry || tb.hasNew || tb.hasSave || tb.hasDelete,
  );
  const hasAnyCrud = menuHasCrud || titleBarsWithCrud.length > 0;

  let stepNum = 2;

  if (!hasAnyCrud) {
    const hasInputGroups =
      popupResult.items.conditionGroups.length > 0 ||
      popupResult.items.infoGroups.length > 0;
    if (hasInputGroups) {
      steps.push(`Step${stepNum++}. 팝업 화면에서 필요한 정보를 입력한다.`);
      steps.push(`Step${stepNum}. 확인 버튼을 클릭하여 팝업을 닫는다.`);
    } else {
      steps.push(`Step${stepNum++}. 팝업 화면에서 필요한 작업을 수행한다.`);
      steps.push(`Step${stepNum}. 작업 완료 후 팝업을 닫는다.`);
    }
    return steps.join("\n");
  }

  if (menuHasCrud) {
    if (menu.hasInquiry) steps.push(`Step${stepNum++}. 조회 조건을 입력하고 '조회' 버튼을 클릭한다.`);
    if (menu.hasNew) steps.push(`Step${stepNum++}. '신규' 버튼을 클릭하여 필요한 정보를 입력한다.`);
    if (menu.hasSave) steps.push(`Step${stepNum++}. 필요한 정보를 입력 후 '저장' 버튼을 클릭한다.`);
    if (menu.hasDelete) steps.push(`Step${stepNum++}. 삭제할 항목을 선택 후 '삭제' 버튼을 클릭한다.`);
  }

  for (const tb of titleBarsWithCrud) {
    const tbLabel = tb.title ? `'${tb.title}'` : "그리드 타이틀바";
    const ops: string[] = [];
    if (tb.hasInquiry) ops.push("조회");
    if (tb.hasNew) ops.push("신규");
    if (tb.hasSave) ops.push("저장");
    if (tb.hasDelete) ops.push("삭제");
    steps.push(`Step${stepNum++}. ${tbLabel} 목록에서 ${ops.join("·")} 작업을 수행한다.`);
  }

  steps.push(`Step${stepNum}. 작업 완료 후 팝업을 닫는다.`);
  return steps.join("\n");
}

// Re-export for convenience
export { extractPopupUrl } from "./crudParser";
