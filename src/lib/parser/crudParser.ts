/**
 * CRUD 함수 패턴 파서
 * - PatisMenuTitleBar (Form_inq~, Form_new~, Form_save~, Form_del~, Form_ext~)
 * - PatisTitleBar (TitleForm_inq~, TitleForm_new~, TitleForm_save~, TitleForm_del~, TitleForm_ext~)
 */
import { CrudInfo, ExtButtonInfo } from '@/types';

/**
 * CSS 클래스명 → 버튼 라벨 매핑
 * value가 빈 문자열인 아이콘 버튼에 의미있는 라벨 부여
 */
const CSS_CLASS_LABEL_MAP: Record<string, string> = {
  'arrow-right':        '>',
  'arrow-left':         '<',
  'arrow-up':           '↑',
  'arrow-down':         '↓',
  'arrow-double-right': '>>',
  'arrow-double-left':  '<<',
  'arrow-right-double': '>>',
  'arrow-left-double':  '<<',
};

/**
 * style.setClasses 에서 첫 번째 클래스명을 추출하여 라벨로 변환
 * 매핑에 없는 클래스는 null 반환
 */
function classToLabel(className: string): string | null {
  return CSS_CLASS_LABEL_MAP[className.trim()] ?? null;
}

/**
 * PatisMenuTitleBar의 CRUD 기능 존재 여부 분석
 * @param content - .clx.js 파일 내용
 * @returns PatisMenuTitleBar CRUD 정보
 */
export function parseMenuTitleBarCrud(content: string): CrudInfo {
  const result: CrudInfo = {
    hasInquiry: false,
    hasNew: false,
    hasSave: false,
    hasDelete: false,
    extButtons: [],
  };

  // 조회 함수 감지 (Form_inqAction 또는 Form_inqClick)
  result.hasInquiry = /function\s+Form_inq(Action|Click)\s*\(/.test(content);

  // 신규 함수 감지
  result.hasNew = /function\s+Form_new(Action|Click)\s*\(/.test(content);

  // 저장 함수 감지
  result.hasSave = /function\s+Form_save(Action|Click)\s*\(/.test(content);

  // 삭제 함수 감지
  result.hasDelete = /function\s+Form_del(Action|Click)\s*\(/.test(content);

  // 추가 버튼 감지 (Form_ext1Click, Form_ext2Click, ...)
  const extMatches = content.matchAll(/function\s+Form_ext(\d+)Click\s*\(/g);
  for (const match of extMatches) {
    const btnIndex = parseInt(match[1]);
    const btnName = extractExtButtonName(content, `Form_ext${btnIndex}Click`);
    const resolvedName = btnName || `추가버튼${btnIndex}`;
    const body = extractFunctionBody(content, `Form_ext${btnIndex}Click`);
    const popupUrl = extractPopupUrl(body) ?? undefined;
    const desc = analyzeBtnFunctionBody(body, resolvedName);
    result.extButtons.push({
      name: resolvedName,
      functionName: `Form_ext${btnIndex}Click`,
      index: btnIndex,
      ...(popupUrl ? { popupUrl } : {}),
      ...(desc ? { description: desc } : {}),
    });
  }

  return result;
}

/**
 * 함수명에 해당하는 함수 바디 블록을 추출 ({ } 중첩 정확 처리)
 */
function extractFunctionBody(content: string, functionName: string): string {
  const fnIdx = content.indexOf(`function ${functionName}`);
  if (fnIdx < 0) return '';
  const start = content.indexOf('{', fnIdx);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(start, i + 1);
    }
  }
  return content.slice(start);
}

/**
 * 함수 바디에서 PatisUtils.openPopup 호출 시 팝업 URL을 추출한다.
 * 패턴: var popupUrl = "경로"; 또는 openPopup(..., "경로", ...)
 */
export function extractPopupUrl(body: string): string | null {
  // 패턴 1: var popupUrl = "경로"
  const varMatch = /var\s+popupUrl\s*=\s*"([^"]+)"/.exec(body);
  if (varMatch) return varMatch[1];
  // 패턴 2: openPopup(popupId, args, "경로", ...) — 세 번째 인자가 문자열 리터럴인 경우
  const callMatch = /openPopup\s*\([^,]+,[^,]+,\s*"([^"]+)"/.exec(body);
  if (callMatch) return callMatch[1];
  return null;
}

/**
 * 버튼 클릭 함수 바디를 분석하여 다단계 설명 생성
 * @returns \n 구분 Step1.~StepN. 형식 문자열, 패턴 미매칭 시 null
 */
function analyzeBtnFunctionBody(body: string, btnName: string): string | null {
  if (!body) return null;
  const steps: string[] = [];
  const name = btnName.trim();

  // 닫기
  if (name === '닫기' || /close/i.test(name)) return 'Step1. 현재 화면을 닫는다.';

  // 엑셀 내보내기
  if (/엑셀|excel/i.test(name) || /ExcelExport|toExcel|exportExcel/i.test(body))
    return `Step1. '${name}' 버튼을 클릭하여 현재 목록을 엑셀 파일로 내보낸다.`;

  // 인쇄/출력
  if (/인쇄|출력|print/i.test(name))
    return `Step1. '${name}' 버튼을 클릭하여 현재 화면을 인쇄한다.`;

  // 초기화
  if (/초기화/.test(name))
    return `Step1. '${name}' 버튼을 클릭하여 조회 조건 및 입력 내용을 초기화한다.`;

  // 함수 바디 패턴 감지
  const hasCheckedRows = /getCheckedRows|isChecked\s*\(|\.checked\b|filter.*checked/i.test(body);
  const hasServiceCall = /app\.serv\s*\(|serviceRequest|\.post\s*\(|\.request\s*\(/.test(body);
  const hasGridUpdate  = /updateData|setColumnValue|setRowValue|addRow|deleteRow/.test(body);
  const hasConfirm     = /app\.confirm\s*\(|confirm\s*\(/.test(body);
  const hasValueSet    = /\.setValue\s*\(|setColumnValue/.test(body);

  // 일괄 변경/처리
  if (/일괄/.test(name)) {
    if (hasCheckedRows || /선택/.test(name)) {
      steps.push('Step1. 변경하고자 하는 항목을 체크박스로 선택한다.');
      steps.push('Step2. 변경할 값을 입력한다.');
      steps.push(`Step3. '${name}' 버튼을 클릭하여 선택된 항목을 일괄 변경한다.`);
      if (hasConfirm) steps.push("Step4. 확인 메시지가 나타나면 '예'를 클릭하여 완료한다.");
    } else {
      steps.push('Step1. 변경할 값을 입력한다.');
      steps.push(`Step2. '${name}' 버튼을 클릭하여 대상 항목을 일괄 변경한다.`);
      if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 완료한다.");
    }
    return steps.join('\n');
  }

  // 조회/검색
  if (/조회$|검색$/.test(name)) {
    steps.push('Step1. 조회 조건을 입력한다.');
    steps.push(`Step2. '${name}' 버튼을 클릭하여 데이터를 조회한다.`);
    return steps.join('\n');
  }

  // 저장
  if (/저장/.test(name)) {
    steps.push('Step1. 수정하고자 하는 자료를 입력한다.');
    steps.push(`Step2. '${name}' 버튼을 클릭하여 저장한다.`);
    if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 저장을 완료한다.");
    return steps.join('\n');
  }

  // 삭제
  if (/삭제/.test(name)) {
    steps.push('Step1. 삭제하고자 하는 항목을 선택한다.');
    steps.push(`Step2. '${name}' 버튼을 클릭하여 삭제를 진행한다.`);
    if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 삭제를 완료한다.");
    return steps.join('\n');
  }

  // 복사
  if (/복사/.test(name)) {
    steps.push('Step1. 복사하고자 하는 항목을 선택한다.');
    steps.push(`Step2. '${name}' 버튼을 클릭하여 항목을 복사한다.`);
    return steps.join('\n');
  }

  // 선택 기반 처리
  if (/선택/.test(name) && hasCheckedRows) {
    steps.push('Step1. 처리하고자 하는 항목을 체크박스로 선택한다.');
    steps.push(`Step2. '${name}' 버튼을 클릭한다.`);
    if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 처리한다.");
    return steps.join('\n');
  }

  // 서비스 호출 패턴
  if (hasServiceCall) {
    if (hasConfirm) {
      steps.push(`Step1. '${name}' 버튼을 클릭한다.`);
      steps.push("Step2. 확인 메시지가 나타나면 '예'를 클릭하여 처리한다.");
      return steps.join('\n');
    }
    return `Step1. '${name}' 버튼을 클릭하여 처리한다.`;
  }

  // 그리드 데이터 변경 패턴
  if (hasGridUpdate || hasValueSet) {
    steps.push(`Step1. '${name}' 버튼을 클릭하여 데이터를 변경한다.`);
    if (hasConfirm) steps.push("Step2. 확인 메시지가 나타나면 '예'를 클릭하여 완료한다.");
    return steps.join('\n');
  }

  // 팝업 호출 패턴
  if (/openPopup|PatisUtils\.openPopup/.test(body)) {
    return `Step1. '${name}' 버튼을 클릭하여 팝업 화면을 연다.`;
  }

  return null; // 패턴 미매칭 → 제너레이터 기본 설명 사용
}

/**
 * PatisTitleBar의 CRUD 기능 존재 여부 분석
 * 복수 PatisTitleBar 지원
 * - PatisTitleBar 변수명을 추출하여 파일 전체에서 title/visibility/initAddButton 속성 검색
 * - 800자 윈도우 방식 대신 변수명 기반 전체 파일 스캔으로 원거리 설정도 감지
 * @param content - .clx.js 파일 내용
 * @returns PatisTitleBar CRUD 정보 배열
 */
export function parseTitleBarCrud(content: string): CrudInfo[] {
  // CRUD 함수 또는 추가 버튼 함수가 하나도 없으면 스킵
  const hasAnyCrudFn = /function\s+TitleForm_(inq|new|save|del)(Action|Click)\s*\(/.test(content);
  const hasAnyExtFn  = /function\s+TitleForm_ext\d+Click\s*\(/.test(content);
  if (!hasAnyCrudFn && !hasAnyExtFn) return [];

  const globalHasSave = /function\s+TitleForm_save(Action|Click)\s*\(/.test(content);
  const globalHasNew  = /function\s+TitleForm_new(Action|Click)\s*\(/.test(content);
  const globalHasDel  = /function\s+TitleForm_del(Action|Click)\s*\(/.test(content);
  const globalHasInq  = /function\s+TitleForm_inq(Action|Click)\s*\(/.test(content);

  // ext 버튼만 있고 CRUD 함수가 하나도 없는 경우:
  // hasNew/hasSave/hasDelete는 전역 함수 존재에 종속되므로 이미 false가 보장되지만,
  // 아래 로직은 PatisTitleBar 변수명/initAddButton 파싱을 위해 계속 진행한다.

  interface BarInfo {
    varName: string | null;
    title: string;
    saveVisible: boolean; saveHidden: boolean;
    newVisible:  boolean; newHidden:  boolean;
    delVisible:  boolean; delHidden:  boolean;
    inqHidden: boolean;
    extButtons: ExtButtonInfo[];
  }

  // ── Step 1: var varName = [linker.xxx =] new udc.common.PatisTitleBar(...) 패턴 탐색 ──
  const allBars: BarInfo[] = [];
  const seenVars = new Set<string>();
  // barId = new udc.common.PatisTitleBar("CT_GRIDTITLE02") 의 첫 번째 문자열 인수
  const tbVarRe = /var\s+(\w+)\s*=\s*(?:\w+\.\w+\s*=\s*)?new\s+udc\.common\.PatisTitleBar\s*\(\s*(?:"([^"]+)")?/g;
  let tbMatch: RegExpExecArray | null;

  while ((tbMatch = tbVarRe.exec(content)) !== null) {
    const varName = tbMatch[1];
    const barId   = tbMatch[2] ?? null; // e.g. "CT_GRIDTITLE02"
    if (seenVars.has(varName)) continue;
    seenVars.add(varName);

    // 변수명 기반 전체 파일 title 검색 (800자 윈도우 제한 없음)
    const titleM = new RegExp(`\\b${varName}\\.title\\s*=\\s*"([^"]+)"`).exec(content);
    // 못 찾으면 생성자 직후 1200자 윈도우에서 폴백
    const winTitle = titleM?.[1] ?? (() => {
      const win = content.slice(tbMatch!.index, tbMatch!.index + 1200);
      return /\.title\s*=\s*"([^"]+)"/.exec(win)?.[1];
    })();
    if (!winTitle) continue; // title이 없는 타이틀바는 스킵

    // 변수명 기반 전체 파일 visibility 검색
    const vt = (suffix: string) => new RegExp(`\\b${varName}\\.${suffix}`).test(content);

    // 변수명 기반 initAddButton 메서드 호출 탐색: varName.initAddButton(index, "label", ...)
    const extButtons: ExtButtonInfo[] = [];
    const seenExtIdx = new Set<number>(); // 동일 index 중복 방지 (initAddButton이 여러 곳에 있을 수 있음)

    const addExtBtn = (idx: number, name: string) => {
      if (seenExtIdx.has(idx)) return;
      seenExtIdx.add(idx);
      const fn   = `TitleForm_ext${idx}Click`;
      const body = extractFunctionBody(content, fn);
      const popupUrl = extractPopupUrl(body) ?? undefined;
      const desc = analyzeBtnFunctionBody(body, name);
      extButtons.push({ name, functionName: fn, index: idx, ...(popupUrl ? { popupUrl } : {}), ...(desc ? { description: desc } : {}) });
    };

    // 형식 B: varName.initAddButton(index, "label")
    const initBtnReB = new RegExp(`\\b${varName}\\.initAddButton\\s*\\(\\s*(\\d+)\\s*,\\s*"([^"]+)"`, 'g');
    let btnM: RegExpExecArray | null;
    while ((btnM = initBtnReB.exec(content)) !== null) {
      addExtBtn(parseInt(btnM[1]), btnM[2]);
    }

    // 형식 C: app.lookup("barId").initAddButton(firstArg, "btnId", "label", ...)
    // ex) app.lookup("CT_GRIDTITLE02").initAddButton(1, "1", "성적전체출력(소급포함)", ...)
    if (barId) {
      const escapedBarId = barId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const initBtnReC = new RegExp(
        `app\\.lookup\\s*\\(\\s*"${escapedBarId}"\\s*\\)\\.initAddButton\\s*\\([^,]+,\\s*"(\\d+)"\\s*,\\s*"([^"]+)"`, 'g'
      );
      while ((btnM = initBtnReC.exec(content)) !== null) {
        addExtBtn(parseInt(btnM[1]), btnM[2]);
      }
    }

    allBars.push({
      varName,
      title:       winTitle,
      saveVisible: vt('isSaveButtonVisible\\s*=\\s*true'),
      saveHidden:  vt('isSaveButtonVisible\\s*=\\s*false'),
      newVisible:  vt('isNewButtonVisible\\s*=\\s*true'),
      newHidden:   vt('isNewButtonVisible\\s*=\\s*false'),
      delVisible:  vt('isDelButtonVisible\\s*=\\s*true'),
      delHidden:   vt('isDelButtonVisible\\s*=\\s*false'),
      inqHidden:   vt('isInqButtonVisible\\s*=\\s*false'),
      extButtons,
    });
  }

  // ── Step 2: var 선언 없이 new udc.common.PatisTitleBar(...)만 있는 경우 폴백 ──
  if (allBars.length === 0) {
    const tbRe2 = /new udc\.common\.PatisTitleBar\([^)]+\)/g;
    while ((tbMatch = tbRe2.exec(content)) !== null) {
      const after = content.slice(tbMatch.index, tbMatch.index + 1200);
      const titleM = /\.title\s*=\s*"([^"]+)"/.exec(after);
      if (!titleM) continue;
      allBars.push({
        varName:     null,
        title:       titleM[1],
        saveVisible: /isSaveButtonVisible\s*=\s*true/.test(after),
        saveHidden:  /isSaveButtonVisible\s*=\s*false/.test(after),
        newVisible:  /isNewButtonVisible\s*=\s*true/.test(after),
        newHidden:   /isNewButtonVisible\s*=\s*false/.test(after),
        delVisible:  /isDelButtonVisible\s*=\s*true/.test(after),
        delHidden:   /isDelButtonVisible\s*=\s*false/.test(after),
        inqHidden:   /isInqButtonVisible\s*=\s*false/.test(after),
        extButtons:  [],
      });
    }
  }

  // ── Step 3: 단일 bar인 경우에만 전역 TitleForm_ext*Click 폴백 보충 ──
  // 복수 bar일 때 globalExtButtons를 모든 bar에 할당하면 Step 5에서 barsWithOwnExt에
  // 전체 bar가 포함되어 모든 bar에 ext 버튼이 붙는 문제 발생 → 단일 bar만 허용
  // 복수 bar의 경우 Step 5에서 isSingleSelected 조건으로 처리
  const globalExtButtons = buildGlobalTitleExtButtons(content);
  if (allBars.length === 1 && allBars[0].extButtons.length === 0 && globalExtButtons.length > 0) {
    allBars[0].extButtons = globalExtButtons;
  }

  // ── Step 4: PatisTitleBar 선언이 전혀 없는 경우 최소 폴백 ──
  if (allBars.length === 0) {
    return [{ hasInquiry: globalHasInq, hasNew: globalHasNew, hasSave: globalHasSave, hasDelete: globalHasDel, extButtons: globalExtButtons }];
  }

  // ── Step 4.5: title 기준 중복 제거 (같은 title을 가진 bars → 첫 번째만 유지, extButtons는 merge) ──
  const dedupedBars: typeof allBars = [];
  const seenTitles = new Set<string>();
  for (const bar of allBars) {
    const key = bar.title.trim();
    if (seenTitles.has(key)) {
      // 동일 title이 이미 있으면 extButtons만 병합 (없는 index만 추가)
      const existing = dedupedBars.find(b => b.title.trim() === key)!;
      const existingIdxs = new Set(existing.extButtons.map(b => b.index));
      for (const btn of bar.extButtons) {
        if (!existingIdxs.has(btn.index)) {
          existing.extButtons.push(btn);
          existingIdxs.add(btn.index);
        }
      }
      continue;
    }
    seenTitles.add(key);
    dedupedBars.push(bar);
  }

  // ── Step 5: 출력할 타이틀바 선택 및 CRUD 플래그 설정 ──
  //
  // 설계 원칙:
  //  ① 자체 initAddButton 보유 bars  → 반드시 포함 (ext 버튼의 실제 소유자)
  //  ② 명시적 CRUD visible=true bars → 반드시 포함 (저장/신규/삭제 버튼 선언)
  //  ③ 둘 다 없으면 첫 번째 bar 폴백
  //
  // CRUD 플래그 원칙:
  //  - visible=true 명시 → 활성화
  //  - 파일 내 bar가 하나뿐이거나 단일 후보 → 전역 함수 + !hidden 폴백 허용
  //  - 복수 선택 → visible=true 명시만 활성화 (전역 함수 블리딩 방지)

  const barsWithOwnExt       = dedupedBars.filter(tb => tb.extButtons.length > 0);
  const barsWithExplicitCrud = dedupedBars.filter(tb => tb.saveVisible || tb.newVisible || tb.delVisible);

  // DEBUG: 파서 결과 확인용 (console에서 titleBars 선택 로직 점검)
  if (typeof console !== 'undefined' && dedupedBars.length > 1) {
    console.debug('[parseTitleBarCrud] dedupedBars:', dedupedBars.map(b => ({
      title: b.title, saveV: b.saveVisible, newV: b.newVisible, delV: b.delVisible,
      extCnt: b.extButtons.length,
    })));
  }

  let selectedBars: typeof dedupedBars;
  if (barsWithOwnExt.length > 0 || barsWithExplicitCrud.length > 0) {
    // 두 집합의 합집합 (선언 순서 유지, 중복 제거)
    const s = new Set([...barsWithOwnExt, ...barsWithExplicitCrud]);
    selectedBars = [...s];
  } else {
    selectedBars = dedupedBars.slice(0, 1);
  }

  const isSingleBarInFile  = dedupedBars.length === 1;
  const isSingleSelected   = selectedBars.length === 1;
  // 전역 CRUD 함수를 !hidden 조건으로 적용할 수 있는지 여부
  // (단일 파일이거나 단일 후보인 경우에만 허용 → 복수 타이틀바 간 블리딩 방지)
  const crudFallbackAllowed = isSingleBarInFile || isSingleSelected;

  return selectedBars.map(tb => ({
    hasInquiry: globalHasInq && !tb.inqHidden,
    hasNew:     globalHasNew  && (tb.newVisible  || (crudFallbackAllowed && !tb.newHidden)),
    hasSave:    globalHasSave && (tb.saveVisible || (crudFallbackAllowed && !tb.saveHidden)),
    hasDelete:  globalHasDel  && (tb.delVisible  || (crudFallbackAllowed && !tb.delHidden)),
    // ext 버튼: 자체 보유 우선; 단일 후보이고 없는 경우에만 전역 폴백 (다중 후보는 빈 배열)
    extButtons: tb.extButtons.length > 0 ? tb.extButtons
              : (isSingleSelected ? globalExtButtons : []),
    title:      tb.title,
  }));
}

/** TitleForm_ext*Click 함수 전체 스캔 → extButtons 빌드 (전역 폴백용) */
function buildGlobalTitleExtButtons(content: string): ExtButtonInfo[] {
  const buttons: ExtButtonInfo[] = [];
  for (const match of content.matchAll(/function\s+TitleForm_ext(\d+)Click\s*\(/g)) {
    const btnIndex = parseInt(match[1]);
    const btnName  = extractExtButtonName(content, `TitleForm_ext${btnIndex}Click`);
    const body     = extractFunctionBody(content, `TitleForm_ext${btnIndex}Click`);
    const popupUrl = extractPopupUrl(body) ?? undefined;
    const desc     = btnName ? analyzeBtnFunctionBody(body, btnName) : null;
    buttons.push({
      name:         btnName || `타이틀바 추가버튼${btnIndex}`,
      functionName: `TitleForm_ext${btnIndex}Click`,
      index:        btnIndex,
      ...(popupUrl ? { popupUrl } : {}),
      ...(desc ? { description: desc } : {}),
    });
  }
  return buttons;
}

/**
 * 파일 전체에서 initAddButton 호출을 파싱하여 버튼 인덱스→레이블 매핑 반환
 *
 * 지원 형식:
 *  A) 전역 호출: initAddButton(firstArg, index, "label", ...)
 *  B) 메서드 호출: varName.initAddButton(index, "label", ...)
 */
function parseInitAddButtonLabels(content: string): Map<number, string> {
  const map = new Map<number, string>();
  // 형식 A: initAddButton(firstArg, index, "label", ...)
  const reA = /initAddButton\s*\([^,)]+,\s*["']?(\d+)["']?\s*,\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = reA.exec(content)) !== null) {
    const idx = parseInt(m[1]);
    if (!map.has(idx)) map.set(idx, m[2]);
  }
  // 형식 B: .initAddButton(index, "label", ...) — 첫 번째 인수가 숫자인 메서드 호출
  const reB = /\.initAddButton\s*\(\s*(\d+)\s*,\s*"([^"]+)"/g;
  while ((m = reB.exec(content)) !== null) {
    const idx = parseInt(m[1]);
    if (!map.has(idx)) map.set(idx, m[2]);
  }
  return map;
}

/**
 * 추가 버튼의 명칭을 추출
 * 1순위: 파일 내 initAddButton 호출에서 인덱스 매핑
 * 2순위: 함수 앞 주석 내 `추가버튼N [이름]` 패턴
 * 3순위: 함수 앞 주석 라인 * ... [이름] 패턴
 * @param content - 파일 전체 내용
 * @param functionName - 함수명 (Form_ext1Click 등)
 * @returns 추출된 버튼 명칭 또는 null
 */
function extractExtButtonName(content: string, functionName: string): string | null {
  const fnIdx = content.indexOf(`function ${functionName}`);
  if (fnIdx < 0) return null;

  // 함수명에서 버튼 인덱스 추출 (Form_ext1Click → 1, TitleForm_ext2Click → 2)
  const idxMatch = /ext(\d+)Click$/.exec(functionName);
  const btnIndex = idxMatch ? parseInt(idxMatch[1]) : null;

  // 1순위: initAddButton(type, index, "label", ...) 호출
  if (btnIndex !== null) {
    const initLabels = parseInitAddButtonLabels(content);
    const label = initLabels.get(btnIndex);
    if (label) return label;
  }

  // 함수 앞 2000자 탐색 영역
  const searchArea = content.slice(Math.max(0, fnIdx - 2000), fnIdx);

  // 2순위: 추가버튼N [이름] 패턴 (예: 추가버튼1 [선택일괄승인])
  const bracketRe = /추가버튼\d+\s+\[([^\]]+)\]/g;
  let lastBracket: RegExpExecArray | null = null;
  let bm: RegExpExecArray | null;
  while ((bm = bracketRe.exec(searchArea)) !== null) lastBracket = bm;
  if (lastBracket) return lastBracket[1].trim();

  // 3순위: * 주석 라인에서 [이름] 추출 (클릭 또는 버튼 언급 포함)
  const commentRe = /\*[^\n]+(?:클릭|버튼)[^\n]*\[([^\]]+)\]/g;
  let lastComment: RegExpExecArray | null = null;
  let cm: RegExpExecArray | null;
  while ((cm = commentRe.exec(searchArea)) !== null) lastComment = cm;
  if (lastComment) return lastComment[1].trim();

  // 4순위: 함수 직전 JSDoc 블록(/** ... */)의 첫 번째 설명 줄
  // 예) * 발주처리 / * 발주 취소 (@param/@author/@see 등 태그 줄 제외)
  const jsdocBlockRe = /\/\*{2,}[\s\S]*?\*\//g;
  let lastJsdoc: RegExpExecArray | null = null;
  let jm: RegExpExecArray | null;
  while ((jm = jsdocBlockRe.exec(searchArea)) !== null) lastJsdoc = jm;
  if (lastJsdoc) {
    const blockLines = lastJsdoc[0].split('\n');
    for (const line of blockLines) {
      // 선행 공백·/ ·* 제거 (/** 열기줄, */ 닫기줄도 빈 문자열이 됨)
      const stripped = line.replace(/^\s*[/*]+\s*/, '').trim();
      if (!stripped || /^@/.test(stripped)) continue;
      // JSDoc 함수 설명 접미사 제거: "버튼 클릭 이벤트함수", "클릭 이벤트함수" 등
      return stripped
        .replace(/\s*버튼\s*클릭\s*이벤트\s*함수\s*$/i, '')
        .replace(/\s*클릭\s*이벤트\s*함수\s*$/i, '')
        .replace(/\s*이벤트\s*함수\s*$/i, '')
        .trim();
    }
  }

  return null;
}

/**
 * 기타 버튼 이벤트 핸들러를 추출
 * (PatisMenuTitleBar, PatisTitleBar 외의 일반 버튼)
 *
 * 감지 패턴:
 *  1) function {name}_onclick(  — 예: BTN_SEARCH_onclick
 *  2) new cpr.controls.Button("ID") + addEventListener("click", handler)
 *     — 예: C_BTN_SRCLS / CONDITIONGROUP01_C_BTN_SRCLS_click
 *
 * @param content - .clx.js 파일 내용
 * @returns 기타 버튼 정보 배열
 */
export function parseExtraButtons(content: string): ExtButtonInfo[] {
  const buttons: ExtButtonInfo[] = [];
  const seenControlId = new Set<string>();
  const seenFuncBase = new Set<string>();

  // ─── 패턴 1: function {name}_onclick( ─────────────────────────────────────
  const onclickRe = /function\s+((?!Form_|TitleForm_|App_)\w+)_onclick\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = onclickRe.exec(content)) !== null) {
    const funcBase = m[1];
    if (seenFuncBase.has(funcBase)) continue;
    seenFuncBase.add(funcBase);
    seenControlId.add(funcBase);
    const body = extractFunctionBody(content, `${funcBase}_onclick`);
    const desc = analyzeBtnFunctionBody(body, funcBase);
    buttons.push({
      name: funcBase,
      functionName: `${funcBase}_onclick`,
      index: buttons.length + 1,
      ...(desc ? { description: desc } : {}),
    });
  }

  // ─── 패턴 2: new cpr.controls.Button("ID") + addEventListener("click", fn) ─
  const btnDeclRe = /var\s+(\w+)\s*=\s*new\s+cpr\.controls\.Button\("([^"]+)"\)/g;
  while ((m = btnDeclRe.exec(content)) !== null) {
    const varName = m[1];
    const controlId = m[2];
    if (seenControlId.has(controlId)) continue;

    // 선언부 이후 ~600자 내에서 .value, addEventListener 탐색
    const afterDecl = content.slice(m.index, m.index + 600);

    // 버튼 라벨: varName.value = "label"
    const valueMatch = new RegExp(`${varName}\\.value\\s*=\\s*"([^"]+)"`).exec(afterDecl);
    const label = valueMatch ? valueMatch[1] : null;

    // value가 없는 경우 CSS 클래스로 라벨 추론 (예: arrow-right → '>')
    const classMatch = new RegExp(
      `${varName}\\.style\\.setClasses\\s*\\(\\s*\\[\\s*"([^"]+)"`,
    ).exec(afterDecl);
    const classLabel = classMatch ? classToLabel(classMatch[1]) : null;

    // 클릭 핸들러: varName.addEventListener("click", handlerFn)
    const handlerMatch = new RegExp(
      `${varName}\\.addEventListener\\("click"\\s*,\\s*(\\w+)\\)`,
    ).exec(afterDecl);
    if (!handlerMatch) continue;

    const handlerFn = handlerMatch[1];
    // 시스템 핸들러 제외
    if (/^Form_|^TitleForm_|^App_/.test(handlerFn)) continue;

    seenControlId.add(controlId);
    const btnLabel = label || classLabel || controlId;
    const body2 = extractFunctionBody(content, handlerFn);
    const desc2 = analyzeBtnFunctionBody(body2, btnLabel);
    buttons.push({
      name: btnLabel,
      functionName: handlerFn,
      index: buttons.length + 1,
      ...(desc2 ? { description: desc2 } : {}),
    });
  }

  return buttons;
}
