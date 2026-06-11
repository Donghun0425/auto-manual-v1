/**
 * CRUD 함수 패턴 파서
 * - PatisMenuTitleBar (Form_inq~, Form_new~, Form_save~, Form_del~, Form_ext~)
 * - PatisTitleBar (TitleForm_inq~, TitleForm_new~, TitleForm_save~, TitleForm_del~, TitleForm_ext~)
 */
import { CrudInfo, CrudOperationLogic, CrudOperationType, ExtButtonInfo, ExtButtonLogic } from '@/types';
import { parseRequiredFields } from './validationParser';

/** 저장 버튼 프레임워크 기본 가드 메시지 (PatisMenuTitleBar 내장 동작) */
const DEFAULT_SAVE_GUARD_MSG = '저장할 내역이 없습니다.';
/** 삭제 버튼 프레임워크 기본 가드 메시지 (PatisMenuTitleBar 내장 동작) */
const DEFAULT_DELETE_GUARD_MSG = '삭제할 내역이 없습니다.';

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

  // 조회 함수 감지 - inqAction 본문에 실질 로직이 있어야 함 (전처리 Click만으로는 불인정)
  result.hasInquiry = /function\s+Form_inqAction\s*\(/.test(content)
    && !isFunctionBodyEmpty(extractFunctionBody(content, 'Form_inqAction'));

  // 신규 함수 감지 - 함수 존재 여부만 확인 (newAction은 빈 바디도 허용)
  result.hasNew = /function\s+Form_new(Action|Click)\s*\(/.test(content);

  // 저장 함수 감지 - Action 본문에 실질 로직이 있어야 함
  result.hasSave = /function\s+Form_save(Action|Click)\s*\(/.test(content)
    && !isFunctionBodyEmpty(extractFunctionBody(content, 'Form_saveAction'));

  // 삭제 함수 감지 - Action 본문에 실질 로직이 있어야 함
  result.hasDelete = /function\s+Form_del(Action|Click)\s*\(/.test(content)
    && !isFunctionBodyEmpty(extractFunctionBody(content, 'Form_delAction'));

  // 추가 버튼 감지 (Form_ext1Click, Form_ext2Click, ...)
  const extMatches = content.matchAll(/function\s+Form_ext(\d+)Click\s*\(/g);
  for (const match of extMatches) {
    const btnIndex = parseInt(match[1]);
    const btnName = extractExtButtonName(content, `Form_ext${btnIndex}Click`);
    const resolvedName = btnName || `추가버튼${btnIndex}`;
    const body = extractFunctionBody(content, `Form_ext${btnIndex}Click`);
    const popupUrl = extractPopupUrl(body) ?? undefined;
    const desc = analyzeBtnFunctionBody(body, resolvedName);
    const logic = analyzeExtButtonLogic(content, `Form_ext${btnIndex}Click`);
    result.extButtons.push({
      name: resolvedName,
      functionName: `Form_ext${btnIndex}Click`,
      index: btnIndex,
      ...(popupUrl ? { popupUrl } : {}),
      ...(desc ? { description: desc } : {}),
      ...(logic ? { logic } : {}),
    });
  }

  // CRUD 작업별 비즈니스 로직 추출 (저장 시 필수입력값/중복불가키 주입)
  const requiredTexts = parseRequiredFields(content).flatMap((rf) => rf.texts);
  const uniqueKeys = parseUniqueKeys(content);
  const operations = buildCrudOperations(content, result, 'Form', requiredTexts, uniqueKeys);
  if (operations.length > 0) result.operations = operations;

  return result;
}

/**
 * 함수 바디가 실질적인 로직 없이 비어있는지 확인
 * 주석·공백·return true; 만 남은 경우 true 반환
 */
function isFunctionBodyEmpty(body: string): boolean {
  if (!body) return true;
  const stripped = body
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  return /^\{\s*(return\s+true\s*;)?\s*\}$/.test(stripped);
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
 * 함수 바디 내 alert("...") 메시지를 추출한다.
 * 이스케이프된 \n 은 공백으로 정리한다.
 */
function collectAlertsInBody(body: string): string[] {
  if (!body) return [];
  const messages: string[] = [];
  const re = /alert\s*\(\s*"([^"]+)"\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    messages.push(m[1].replace(/\\n/g, ' ').trim());
  }
  return messages;
}

/** unique1Text(중복불가키) 배열을 추출한다. 예: new Array("기준년도","기준학기") → [기준년도, 기준학기] */
export function parseUniqueKeys(content: string): string[] {
  const m = /setAppProperty\(\s*app\s*,\s*app\.lookup\("[^"]+"\)\s*,\s*"unique1Text",\s*new Array\(([^)]+)\)\)/.exec(content);
  if (!m) return [];
  const keys: string[] = [];
  const re = /"([^"]+)"/g;
  let inner: RegExpExecArray | null;
  while ((inner = re.exec(m[1])) !== null) {
    if (inner[1].trim()) keys.push(inner[1].trim());
  }
  return keys;
}

/** 완료 메시지 패턴 (After 함수에서 분리 보관) */
const COMPLETION_MSG_RE = /(되었습니다|완료되었습니다|하였습니다)/;

/**
 * 단일 CRUD 작업의 비즈니스 로직을 함수 라이프사이클(Click→Action→After)에서 정적 분석한다.
 * @param content      파일 전체 내용
 * @param operation    작업 종류 (조회/신규/저장/삭제)
 * @param prefix       함수 접두사 (Form 또는 TitleForm)
 * @param requiredTexts 필수 입력값 (저장 전용)
 * @param uniqueTexts  중복 불가 키 (저장 전용)
 */
function analyzeCrudOperation(
  content: string,
  operation: CrudOperationType,
  prefix: 'Form' | 'TitleForm',
  requiredTexts: string[] = [],
  uniqueTexts: string[] = []
): CrudOperationLogic {
  const opKey = operation === '조회' ? 'inq'
    : operation === '신규' ? 'new'
    : operation === '저장' ? 'save'
    : 'del';

  const clickBody  = extractFunctionBody(content, `${prefix}_${opKey}Click`);
  const actionBody = extractFunctionBody(content, `${prefix}_${opKey}Action`);
  const afterBody  = extractFunctionBody(content, `${prefix}_${opKey}After`);

  // 시그널 분석 (analyzeBtnFunctionBody와 동일 패턴 재사용 + PatisTransaction 추가)
  const combinedBody = clickBody + '\n' + actionBody;
  const hasConfirm = /app\.confirm\s*\(|confirm\s*\(/.test(combinedBody);
  const hasServiceCall = /app\.serv\s*\(|serviceRequest|PatisTransaction\s*\(|\.post\s*\(|\.request\s*\(/.test(combinedBody);
  const popupUrl = extractPopupUrl(actionBody) ?? extractPopupUrl(clickBody) ?? undefined;

  // 검증 메시지 수집 (Click + Action)
  const validations = [...collectAlertsInBody(clickBody), ...collectAlertsInBody(actionBody)];

  // 사전조건: Click 전처리의 검증 메시지 (사용자가 먼저 취해야 할 행동/가드)
  const preconditions = collectAlertsInBody(clickBody);

  // 완료 메시지: After 함수에서 분리 보관 (프롬프트 미노출)
  const completionMessage = collectAlertsInBody(afterBody).find((msg) => COMPLETION_MSG_RE.test(msg));

  // 처리 단계 설명 (시그널 → 문장)
  const processNotes: string[] = [];
  if (popupUrl) processNotes.push('팝업 화면을 호출합니다.');
  if (hasServiceCall) processNotes.push('서버에 전송하여 처리합니다.');
  if (hasConfirm) processNotes.push('확인창에서 사용자 확인을 받습니다.');

  const result: CrudOperationLogic = {
    operation,
    preconditions,
    processNotes,
    validations,
    hasConfirm,
    hasServiceCall,
    ...(popupUrl ? { popupUrl } : {}),
    ...(completionMessage ? { completionMessage } : {}),
  };

  // 저장 전용: 필수 입력값 + 중복 불가 키
  if (operation === '저장') {
    if (requiredTexts.length > 0) result.requiredFields = requiredTexts;
    if (uniqueTexts.length > 0) result.uniqueKeys = uniqueTexts;
    // 프레임워크 기본 가드 — 동일 의미 커스텀 가드가 없을 때만 주입
    const hasCustomSaveGuard = validations.some((v) => /저장.*(없|내역)/.test(v) || /수정.*없/.test(v));
    if (!hasCustomSaveGuard) preconditions.unshift(DEFAULT_SAVE_GUARD_MSG);
  }

  // 삭제 전용: 프레임워크 기본 가드 — 동일 의미 커스텀 가드가 없을 때만 주입
  if (operation === '삭제') {
    const hasCustomDeleteGuard = validations.some((v) => /삭제.*(없|내역)/.test(v) || /선택.*없/.test(v));
    if (!hasCustomDeleteGuard) preconditions.unshift(DEFAULT_DELETE_GUARD_MSG);
  }

  return result;
}

/**
 * CrudInfo의 활성 CRUD 플래그를 기준으로 operations 배열을 생성한다.
 */
function buildCrudOperations(
  content: string,
  crud: Pick<CrudInfo, 'hasInquiry' | 'hasNew' | 'hasSave' | 'hasDelete'>,
  prefix: 'Form' | 'TitleForm',
  requiredTexts: string[],
  uniqueTexts: string[]
): CrudOperationLogic[] {
  const operations: CrudOperationLogic[] = [];
  if (crud.hasInquiry) operations.push(analyzeCrudOperation(content, '조회', prefix));
  if (crud.hasNew)     operations.push(analyzeCrudOperation(content, '신규', prefix));
  if (crud.hasSave)    operations.push(analyzeCrudOperation(content, '저장', prefix, requiredTexts, uniqueTexts));
  if (crud.hasDelete)  operations.push(analyzeCrudOperation(content, '삭제', prefix));
  return operations;
}

/** 위임 추적 시 제외할 JS 예약어/내장 토큰 */
const DELEGATION_KEYWORD_SET = new Set([
  'if', 'for', 'while', 'do', 'return', 'function', 'switch', 'catch',
  'typeof', 'instanceof', 'new', 'delete', 'void', 'throw', 'else',
  'var', 'let', 'const', 'alert', 'confirm', 'parseInt', 'parseFloat',
  'Number', 'String', 'Array', 'Boolean', 'console',
]);

/**
 * 버튼 본문이 직접 호출하는 사용자 정의 함수의 본문을 1단계만 합쳐서 반환한다.
 * (프레임워크/내장 함수, Form_/TitleForm_/App_ 접두 함수는 제외)
 * @param content 파일 전체 내용
 * @param body    버튼 클릭 핸들러 본문
 */
function resolveDelegatedBody(content: string, body: string): string {
  if (!body) return '';
  const collected: string[] = [];
  const seen = new Set<string>();
  for (const call of body.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) {
    const fnName = call[1];
    if (DELEGATION_KEYWORD_SET.has(fnName)) continue;
    if (/^(Form_|TitleForm_|App_|Patis)/.test(fnName)) continue;
    if (seen.has(fnName)) continue;
    seen.add(fnName);
    // 사용자 정의 함수만 (파일 내 function 선언 존재)
    if (!new RegExp(`function\\s+${fnName}\\s*\\(`).test(content)) continue;
    const delegated = extractFunctionBody(content, fnName);
    if (delegated) collected.push(delegated);
  }
  return collected.join('\n');
}

/**
 * 함수 바디 내 confirm("...") 인자 문자열을 추출한다.
 * 이스케이프된 \n 은 공백으로 정리한다.
 */
function collectConfirmsInBody(body: string): string[] {
  if (!body) return [];
  const messages: string[] = [];
  const re = /confirm\s*\(\s*"([^"]+)"\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    messages.push(m[1].replace(/\\n/g, ' ').trim());
  }
  return messages;
}

/**
 * ext/독립 버튼의 비즈니스 로직을 본문(+1단계 위임 함수)에서 정적 분석한다.
 * 의미있는 신호(가드/검증/확인/팝업/서버호출)가 없으면 undefined 반환.
 * @param content      파일 전체 내용
 * @param functionName 버튼 클릭 핸들러 함수명
 */
function analyzeExtButtonLogic(content: string, functionName: string): ExtButtonLogic | undefined {
  const ownBody = extractFunctionBody(content, functionName);
  if (!ownBody) return undefined;
  const delegatedBody = resolveDelegatedBody(content, ownBody);
  const combinedBody = ownBody + '\n' + delegatedBody;

  // 시그널 분석
  const hasConfirm = /app\.confirm\s*\(|confirm\s*\(/.test(combinedBody);
  const hasServiceCall = /app\.serv\s*\(|serviceRequest|PatisTransaction\s*\(|\.post\s*\(|\.request\s*\(/.test(combinedBody);
  const hasPopup = /openPopup|PatisUtils\.openPopup/.test(combinedBody);
  const hasExcel = /ExcelExport|toExcel|exportExcel|exportAsExcel/i.test(combinedBody);
  const hasPrint = /\.print\s*\(|printReport/i.test(combinedBody);
  const hasGridUpdate = /updateData|setColumnValue|setRowValue|addRow|deleteRow|insertRow/.test(combinedBody);
  const hasCheckedRows = /getCheckedRows|isChecked\s*\(|\.checked\b/i.test(combinedBody);
  const popupUrl = extractPopupUrl(ownBody) ?? extractPopupUrl(delegatedBody) ?? undefined;

  // 메시지 수집
  const allAlerts = collectAlertsInBody(combinedBody);
  const confirmMessages = collectConfirmsInBody(combinedBody);

  // 완료 메시지 분리 (프롬프트 미노출)
  const completionMessage = allAlerts.find((msg) => COMPLETION_MSG_RE.test(msg));

  // 가드(진행 차단) vs 일반 검증 분리: alert 직후 return false 근접 여부
  const guards: string[] = [];
  const validations: string[] = [];
  for (const msg of allAlerts) {
    if (msg === completionMessage) continue;
    const escaped = msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const guardRe = new RegExp(`alert\\s*\\(\\s*"${escaped}"\\s*\\)\\s*;?\\s*(?:return\\s+false|return\\s*;|e\\.preventDefault)`);
    if (guardRe.test(combinedBody)) guards.push(msg);
    else validations.push(msg);
  }

  // 처리 단계 설명 (시그널 → 문장)
  const processNotes: string[] = [];
  if (popupUrl || hasPopup) processNotes.push('팝업 화면을 호출합니다.');
  if (hasExcel) processNotes.push('현재 목록을 엑셀 파일로 내보냅니다.');
  if (hasPrint) processNotes.push('현재 화면을 인쇄합니다.');
  if (hasCheckedRows) processNotes.push('선택(체크)한 항목을 대상으로 처리합니다.');
  if (hasServiceCall) processNotes.push('서버에 전송하여 처리합니다.');
  else if (hasGridUpdate) processNotes.push('화면의 데이터를 변경합니다.');

  // 의미있는 신호가 전혀 없으면 logic 생략 (description 폴백 사용)
  const hasSignal = guards.length > 0 || validations.length > 0 || confirmMessages.length > 0
    || processNotes.length > 0 || hasConfirm || hasServiceCall;
  if (!hasSignal) return undefined;

  return {
    guards,
    validations,
    confirmMessages,
    processNotes,
    hasConfirm,
    hasServiceCall,
    ...(popupUrl ? { popupUrl } : {}),
    ...(completionMessage ? { completionMessage } : {}),
  };
}


/** 함수 바디에서 추출한 팝업/서비스 전달 매개변수 한 건 */
interface PopupParam {
  key: string;        // 매개변수 키 (예: P_CRTR_YR)
  label: string;      // 표시 라벨 (인라인 주석 우선, 없으면 키 접두사 매핑)
  isLiteral: boolean; // 값이 문자열 리터럴(고정값)이면 true → 사용자 입력 아님
}

/** 키 토큰 → 한글 라벨 매핑 (인라인 주석이 없을 때 폴백) */
const PARAM_TOKEN_LABEL: Record<string, string> = {
  CRTR:  '기준',
  TRGT:  '대상',
  REG:   '등록',
  YR:    '연도',
  SMSTR: '학기',
  CLG:   '대학',
  SCYR:  '학년',
  NM:    '명',
};

/** 매개변수 키(P_CRTR_YR 등)를 토큰 매핑으로 한글 라벨화 */
function keyToLabel(key: string): string {
  const tokens = key.split('_').filter((t) => t && t.toUpperCase() !== 'P');
  const parts = tokens.map((t) => PARAM_TOKEN_LABEL[t.toUpperCase()] ?? '').filter(Boolean);
  return parts.join(' ').trim();
}

/**
 * 함수 바디에서 argumentsList["키"]=값; //주석 또는 parameters["키"]=값; //주석 형태의
 * 매개변수를 추출한다. 라벨은 인라인 주석 우선, 없으면 키 접두사 매핑으로 폴백.
 */
function extractPopupParams(body: string): PopupParam[] {
  const params: PopupParam[] = [];
  const seen = new Set<string>();
  const re = /(?:argumentsList|parameters)\s*\[\s*["']([^"']+)["']\s*\]\s*=\s*([^;\n]+);?[ \t]*(?:\/\/[ \t]*([^\n]*))?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const value = m[2].trim();
    const comment = (m[3] ?? '').trim();
    const isLiteral = /^["'][^"']*["']$/.test(value);
    params.push({ key, label: comment || keyToLabel(key), isLiteral });
  }
  return params;
}

/** 라벨 앞쪽의 그룹 접두사(기준/복사/대상)를 제거하여 항목명만 남긴다 */
function stripGroupPrefix(label: string, prefixes: string[]): string {
  let l = label.trim();
  for (const p of prefixes) {
    if (l.startsWith(p)) {
      l = l.slice(p.length).trim();
      break;
    }
  }
  return l;
}

/**
 * 복사 매개변수를 기준/대상/기타 그룹으로 묶어 요약 문구를 만든다.
 * 고정 리터럴 값(예: "ALL")은 사용자 입력이 아니므로 제외한다.
 * 예) "복사 기준(연도·학기)과 복사 대상(연도·학기)"
 */
function summarizeCopyParams(params: PopupParam[]): string {
  const base: string[] = [];
  const target: string[] = [];
  const other: string[] = [];
  for (const p of params) {
    if (p.isLiteral) continue; // 고정값 제외
    const k = p.key.toUpperCase();
    if (/기준/.test(p.label) || /CRTR/.test(k)) base.push(stripGroupPrefix(p.label, ['기준']));
    else if (/복사|대상/.test(p.label) || /TRGT/.test(k)) target.push(stripGroupPrefix(p.label, ['복사', '대상']));
    else other.push(p.label);
  }
  const norm = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.replace(/년도/g, '연도').trim()).filter(Boolean)));
  const b = norm(base);
  const t = norm(target);
  const o = norm(other);
  const parts: string[] = [];
  if (b.length) parts.push(`복사 기준(${b.join('·')})`);
  if (t.length) parts.push(`복사 대상(${t.join('·')})`);
  if (o.length) parts.push(o.join('·'));
  return parts.join('과 ');
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
    } else if (hasCheckedRows || /생성/.test(name)) {
      steps.push('Step1. 생성 조건을 선택한다.');
      steps.push(`Step2. '${name}' 버튼을 클릭하여 일괄 생성한다.`);
      if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 완료한다.");   
    } else if (hasCheckedRows || /삭제/.test(name)) {
      steps.push('Step1. 삭제 조건을 선택한다.');
      steps.push(`Step2. '${name}' 버튼을 클릭하여 일괄 삭제한다.`);
      if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 완료한다.");               
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
    const hasPopup = /openPopup|PatisUtils\.openPopup/.test(body);
    // 미저장 자료 가드: alert 메시지에 '저장'을 포함하며 return false 하는 사전조건
    const hasSaveGuard = /return\s+false/.test(body) && /alert\s*\([^)]*저장/.test(body);

    if (hasPopup) {
      // 팝업 기반 복사: 전달 매개변수를 분석해 입력/선택 항목을 안내
      const summary = summarizeCopyParams(extractPopupParams(body));
      let n = 1;
      if (hasSaveGuard) steps.push(`Step${n++}. 수정 중인 자료가 있으면 먼저 저장한다.`);
      steps.push(`Step${n++}. '${name}' 버튼을 클릭하여 복사 팝업을 연다.`);
      steps.push(
        summary
          ? `Step${n++}. 팝업에서 ${summary}을 선택한다.`
          : `Step${n++}. 팝업에서 복사 기준과 복사 대상을 선택한다.`
      );
      if (hasConfirm) steps.push(`Step${n++}. 확인 메시지가 나타나면 '예'를 클릭하여 복사를 완료한다.`);
      else steps.push(`Step${n++}. 선택한 기준의 자료가 대상으로 복사된다.`);
      return steps.join('\n');
    }

    // 팝업 없음: 그리드 선택 기반 복사 (폴백)
    steps.push('Step1. 복사하고자 하는 항목을 선택한다.');
    steps.push(`Step2. '${name}' 버튼을 클릭하여 항목을 복사한다.`);
    if (hasConfirm) steps.push("Step3. 확인 메시지가 나타나면 '예'를 클릭하여 완료한다.");
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

  const globalHasSave = /function\s+TitleForm_save(Action|Click)\s*\(/.test(content)
    && !isFunctionBodyEmpty(extractFunctionBody(content, 'TitleForm_saveAction'));
  const globalHasNew  = /function\s+TitleForm_new(Action|Click)\s*\(/.test(content); // 빈 바디도 허용
  const globalHasDel  = /function\s+TitleForm_del(Action|Click)\s*\(/.test(content)
    && !isFunctionBodyEmpty(extractFunctionBody(content, 'TitleForm_delAction'));
  const globalHasInq  = /function\s+TitleForm_inqAction\s*\(/.test(content)
    && !isFunctionBodyEmpty(extractFunctionBody(content, 'TitleForm_inqAction'));

  // 저장 작업 비즈니스 로직용 필수입력값/중복불가키 (파일 전역)
  const titleRequiredTexts = parseRequiredFields(content).flatMap((rf) => rf.texts);
  const titleUniqueKeys = parseUniqueKeys(content);

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
      const logic = analyzeExtButtonLogic(content, fn);
      extButtons.push({ name, functionName: fn, index: idx, ...(popupUrl ? { popupUrl } : {}), ...(desc ? { description: desc } : {}), ...(logic ? { logic } : {}) });
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
    const fallback: CrudInfo = { hasInquiry: globalHasInq, hasNew: globalHasNew, hasSave: globalHasSave, hasDelete: globalHasDel, extButtons: globalExtButtons };
    const fbOps = buildCrudOperations(content, fallback, 'TitleForm', titleRequiredTexts, titleUniqueKeys);
    if (fbOps.length > 0) fallback.operations = fbOps;
    return [fallback];
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

  return selectedBars.map(tb => {
    const barCrud: CrudInfo = {
      hasInquiry: globalHasInq && !tb.inqHidden,
      hasNew:     globalHasNew  && (tb.newVisible  || (crudFallbackAllowed && !tb.newHidden)),
      hasSave:    globalHasSave && (tb.saveVisible || (crudFallbackAllowed && !tb.saveHidden)),
      hasDelete:  globalHasDel  && (tb.delVisible  || (crudFallbackAllowed && !tb.delHidden)),
      // ext 버튼: 자체 보유 우선; 단일 후보이고 없는 경우에만 전역 폴백 (다중 후보는 빈 배열)
      extButtons: tb.extButtons.length > 0 ? tb.extButtons
                : (isSingleSelected ? globalExtButtons : []),
      title:      tb.title,
    };
    const barOps = buildCrudOperations(content, barCrud, 'TitleForm', titleRequiredTexts, titleUniqueKeys);
    if (barOps.length > 0) barCrud.operations = barOps;
    return barCrud;
  });
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
    const logic    = analyzeExtButtonLogic(content, `TitleForm_ext${btnIndex}Click`);
    buttons.push({
      name:         btnName || `타이틀바 추가버튼${btnIndex}`,
      functionName: `TitleForm_ext${btnIndex}Click`,
      index:        btnIndex,
      ...(popupUrl ? { popupUrl } : {}),
      ...(desc ? { description: desc } : {}),
      ...(logic ? { logic } : {}),
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
      // "PatisMenuTitleBar 추가버튼N [임의텍스트] (실제레이블)" 형식 → 괄호 안 레이블만 추출
      // 예) "PatisMenuTitleBar 추가버튼1 클릭 전처리 함수 (전년도 자료복사)" → "전년도 자료복사"
      const patisMatch = /PatisMenuTitleBar\s+추가버튼\d+[^(]*\(([^)]+)\)/.exec(stripped);
      if (patisMatch) return patisMatch[1].trim();
      // 일반 괄호 추출: 줄 끝에 "(레이블)" 형식이 있으면 괄호 안 내용을 우선 반환
      // 예) "추가버튼1 클릭 전처리 함수 (전년도 자료복사)" → "전년도 자료복사"
      const parenMatch = /\(([^)]+)\)\s*$/.exec(stripped);
      if (parenMatch) return parenMatch[1].trim();
      // JSDoc 함수 설명 접미사·접두사 제거 (위 두 패턴 모두 실패한 경우의 fallback)
      return stripped
        .replace(/^(?:PatisMenuTitleBar\s+)?추가버튼\d+\s*/i, '') // 선두 접두사 제거
        .replace(/\s*버튼\s*클릭\s*이벤트\s*함수\s*$/i, '')
        .replace(/\s*클릭\s*이벤트\s*함수\s*$/i, '')
        .replace(/\s*이벤트\s*함수\s*$/i, '')
        .replace(/\s*클릭\s*전처리\s*함수\s*$/i, '')  // 추가: "클릭 전처리 함수"
        .replace(/\s*클릭\s*처리\s*함수\s*$/i, '')
        .replace(/\s*처리\s*함수\s*$/i, '')
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

  // ── B: Form_ext*/TitleForm_ext* 바디에서 직접 호출(위임)하는 함수명 수집 ──
  // PatisTitleBar/PatisMenuTitleBar ext 버튼이 내부적으로 위임하는 핸들러와
  // 동일한 이름의 독립 버튼이 UI 섹션에 선언된 경우 중복 감지를 방지한다.
  const KEYWORD_SET = new Set([
    'if', 'for', 'while', 'do', 'return', 'function', 'switch',
    'catch', 'typeof', 'instanceof', 'new', 'delete', 'void', 'throw',
  ]);
  const extDelegatedFns = new Set<string>();
  for (const em of content.matchAll(/function\s+((?:Form_ext|TitleForm_ext)\d+Click)\s*\(/g)) {
    const body = extractFunctionBody(content, em[1]);
    for (const call of body.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) {
      if (!KEYWORD_SET.has(call[1])) extDelegatedFns.add(call[1]);
    }
  }

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
    const logic = analyzeExtButtonLogic(content, `${funcBase}_onclick`);
    buttons.push({
      name: funcBase,
      functionName: `${funcBase}_onclick`,
      index: buttons.length + 1,
      ...(desc ? { description: desc } : {}),
      ...(logic ? { logic } : {}),
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
    // ext 버튼이 위임하는 핸들러 제외 (PatisTitleBar/PatisMenuTitleBar ext 버튼 중복 방지)
    if (extDelegatedFns.has(handlerFn)) continue;

    // SEARCHGROUP 내 버튼은 조회조건 영역이므로 사용방법 섹션에서 제외
    if (controlId.startsWith('SEARCHGROUP')) continue;

    // visible = false 로 명시된 버튼은 화면에 노출되지 않으므로 사용방법에서 제외
    if (new RegExp(`${varName}\\.visible\\s*=\\s*false\\b`).test(afterDecl)) continue;

    // label/classLabel 모두 없는 경우: 단순 제외 (내부 ID 노출 방지)
    const btnLabel = label || classLabel;
    if (!btnLabel) continue;

    seenControlId.add(controlId);
    const body2 = extractFunctionBody(content, handlerFn);
    const desc2 = analyzeBtnFunctionBody(body2, btnLabel);
    const logic2 = analyzeExtButtonLogic(content, handlerFn);
    buttons.push({
      name: btnLabel,
      functionName: handlerFn,
      index: buttons.length + 1,
      ...(desc2 ? { description: desc2 } : {}),
      ...(logic2 ? { logic: logic2 } : {}),
    });
  }

  return buttons;
}
