/**
 * INFOGROUP 파서
 * - new cpr.controls.Container("INFOGROUP\d+") + style.setClasses(["cl-form-group"])
 *   패턴으로 세부정보 입력 그룹을 탐지한다.
 * - CT_INFOTITLE{N} PatisTitleBar 의 title 속성을 그룹 제목으로 사용한다.
 * - 그룹 IIFE 내부의 T_* Output(항목명) + 대응 컨트롤(타입) 쌍을 추출한다.
 */
import type { ConditionControlInfo, InfoGroupInfo } from '@/types';
import { normalizeLabel } from '../utils.ts';
import { isControlVisibleInLayout } from './visibility.ts';

/** 입력 컨트롤로 간주하는 타입 집합 */
const INPUT_TYPES = new Set([
  'InputBox', 'TextArea', 'ComboBox', 'CheckBox',
  'DatePicker', 'NumberInput', 'SpinBox', 'RadioGroup', 'RadioButton',
  'PatisCombo', 'PatisDatePicker',
]);

/** 전체 타입 경로에서 간략 타입명 추출 */
function shortType(raw: string): string {
  return raw.split('.').pop() ?? raw;
}

/**
 * 컨테이너 선언 직후의 (function(container){…}) 본문을 중괄호 카운팅으로 추출
 * - 컨테이너 선언 이후 maxDistance(기본 8000자) 이내에서 시작점을 탐색
 */
function extractFunctionBody(
  content: string,
  searchFrom: number,
  maxDistance = 8000,
): string | null {
  const funcMarker = '(function(container){';
  const start = content.indexOf(funcMarker, searchFrom);
  if (start < 0 || start - searchFrom > maxDistance) return null;

  let depth = 0;
  let i = start;
  while (i < content.length) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(start + funcMarker.length, i);
      }
    }
    i++;
  }
  return null;
}

/**
 * INFOGROUP 파싱 메인 함수
 */
export function parseInfoGroups(content: string): InfoGroupInfo[] {
  const result: InfoGroupInfo[] = [];

  // ── Step 1: CT_INFOTITLE{N} 타이틀 맵 구성 ───────────────────────────────
  // "01" → "공통코드(3레벨) 세부정보" 형태
  const titleMap = new Map<string, string>();
  // CT_INFOTITLE01, CT_TABPAGE02_INFOTITLE01 등 다양한 접두사 패턴 허용
  const titleDeclRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+udc\.common\.PatisTitleBar\("CT_[^"]*INFOTITLE(\d+)"\)/g;
  let tm: RegExpExecArray | null;
  while ((tm = titleDeclRe.exec(content)) !== null) {
    const tvName = tm[1];
    const tNum = tm[2];
    // 선언 이후 800자 이내에서 varName.title = "..." 탐색
    const after = content.slice(tm.index, tm.index + 800);
    const titleM = new RegExp(`${tvName}\\.title\\s*=\\s*"([^"]+)"`).exec(after);
    if (titleM) titleMap.set(tNum, titleM[1]);
  }

  // ── Step 2: INFOGROUP{N} Container 탐색 ──────────────────────────────────
  const groupRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+cpr\.controls\.Container\("(INFOGROUP(\d+))"\)/g;
  let gm: RegExpExecArray | null;
  while ((gm = groupRe.exec(content)) !== null) {
    const varName = gm[1];
    const groupId = gm[2];
    const groupNum = gm[3];

    // cl-form-group 클래스 확인 (선언 이후 300자 이내)
    const afterDecl = content.slice(gm.index, gm.index + 300);
    if (!afterDecl.includes('cl-form-group')) continue;

    // ── Step 3: IIFE 본문 추출 ───────────────────────────────────────────
    const body = extractFunctionBody(content, gm.index);
    if (!body) continue;

    // ── Step 4: T_* Output 컨트롤 → 항목명 맵 ──────────────────────────
    // { oVarName → { controlId: "T_S_XXX", labelText: "항목명" } }
    const outputMap = new Map<string, { controlId: string; labelText: string }>();
    const outputDeclRe = /var\s+(\w+)\s*=\s*new\s+cpr\.controls\.Output\("(T_[^"]+)"\)/g;
    let om: RegExpExecArray | null;
    while ((om = outputDeclRe.exec(body)) !== null) {
      const oVarName = om[1];
      const controlId = om[2];
      // 선언 이후 200자 이내에서 varName.value = "..." 탐색
      const afterOutput = body.slice(om.index, om.index + 200);
      const valueM = new RegExp(`${oVarName}\\.value\\s*=\\s*"([^"]+)"`).exec(afterOutput);
      outputMap.set(oVarName, { controlId, labelText: valueM ? normalizeLabel(valueM[1]) : controlId });
    }

    // ── Step 5: D_ 컨트롤 타입 맵 ───────────────────────────────────────
    // cpr.controls.TYPE("D_XXX") → TYPE
    const controlTypeMap = new Map<string, string>();

    // cpr.controls.TYPE
    const cprDeclRe = /var\s+\w+\s*=\s*new\s+cpr\.controls\.(\w+)\("([^"]+)"\)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cprDeclRe.exec(body)) !== null) {
      if (cm[2].startsWith('T_')) continue;
      controlTypeMap.set(cm[2], cm[1]);
    }

    // udc.*.TYPE (UDC 컨트롤)
    const udcDeclRe = /var\s+\w+\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+(udc\.[\w.]+)\("([^"]+)"\)/g;
    let udcm: RegExpExecArray | null;
    while ((udcm = udcDeclRe.exec(body)) !== null) {
      if (udcm[2].startsWith('T_')) continue;
      controlTypeMap.set(udcm[2], shortType(udcm[1]));
    }

    // ── Step 6: controls 목록 구성 ──────────────────────────────────────
    const controls: ConditionControlInfo[] = [];
    for (const [, { controlId, labelText }] of outputMap) {
      // T_D_ABNM_L3 → D_ABNM_L3, T_S_STUNO → S_STUNO (앞의 "T_" 제거)
      const dataCtrlId = controlId.replace(/^T_/, '');

      // 의미없는 항목 제거
      // 1) 구분자 라벨 (-,~,/ 등)
      if (/^[~\-\/|·•]+$/.test(labelText.trim())) continue;
      // 2) NOTHING 플레이스홀더
      if (dataCtrlId.includes('NOTHING')) continue;
      // 3) 라벨을 찾지 못해 controlId 자체가 라벨로 폴백된 경우
      if (labelText === controlId || labelText === dataCtrlId) continue;

      // 4) visible = false 로 명시된 컨트롤은 화면에 노출되지 않으므로 제외
      if (!isControlVisibleInLayout(body, dataCtrlId)) continue;

      const ctrlType = controlTypeMap.get(dataCtrlId) ?? 'InputBox';
      const isInput = INPUT_TYPES.has(ctrlType);

      controls.push({
        controlId: dataCtrlId,
        labelText,
        description: '',
        controlType: ctrlType,
        inputType: isInput ? '입력' : '표시',
      });
    }

    result.push({
      groupId,
      // CT_INFOTITLE{N} 맵 탐색 먼저, 없으면 INFOGROUP body 내 PatisTitleBar title 탐색
      title: titleMap.get(groupNum) ?? findTitleInBody(body),
      controls,
    });
  }

  return result;
}

/**
 * 컨테이너 IIFE 본문 내에서 임의 PatisTitleBar의 title 속성값을 추출한다.
 * CT_INFOTITLE 네이밍 규칙을 따르지 않는 CLX 파일의 폴백 처리용.
 */
function findTitleInBody(body: string): string | undefined {
  const tbM = /new\s+udc\.common\.PatisTitleBar\("[^"]+"\)/.exec(body);
  if (!tbM) return undefined;
  const afterTb = body.slice(tbM.index, tbM.index + 600);
  const titleM = /\.title\s*=\s*"([^"]+)"/.exec(afterTb);
  return titleM?.[1];
}
