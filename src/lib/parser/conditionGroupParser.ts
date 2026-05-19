/**
 * 조회조건/처리조건 그룹 파서
 * - new cpr.controls.Container("SEARCHGROUP…")   → 조회조건
 * - new cpr.controls.Container("CONDITIONGROUP…") → 처리조건
 * 그룹 안의 (function(container){…})(groupVar) 블록을 파싱하여
 * 라벨(Output T_*) + 입력 컨트롤 쌍을 추출한다.
 *
 * UDC(User Defined Control) 처리:
 * - PatisCombo: 별도 Output 라벨이 존재하므로 기존 방식 그대로
 * - 그 외 UDC: UDC_REGISTRY의 labelFns를 기반으로 정밀 탐색;
 *             호스트 파일에 없으면 defaultLabels 폴백
 * - CheckBox: .text = "..." 속성을 라벨로 사용
 */
import { ConditionGroupInfo, ConditionControlInfo } from '@/types';
import { UDC_REGISTRY, UdcInfo } from './udcRegistry';

/** 입력 컨트롤로 간주하지 않을 타입 키워드 */
const SKIP_TYPES = new Set([
  'Output', 'Button', 'Container', 'Grid', 'PatisTitleBar',
  'PatisMenuTitleBar', 'ProgressBar', 'Splitter', 'TabPanel',
  'UcoBtchList',  // 내장 그리드 컴포넌트 — 별도 그리드 항목으로 처리
]);

/** 별도 Output 라벨 쌍으로 처리하는 UDC */
const OUTPUT_LABEL_UDCS = new Set(['PatisCombo']);

/** 타입 경로에서 간략 타입명 추출 (예: udc.common.PatisCombo → PatisCombo) */
function shortType(fullType: string): string {
  return fullType.split('.').pop() ?? fullType;
}

/** UDC 여부 (new udc.* 로 시작하는 타입) */
function isUdcType(fullType: string): boolean {
  return fullType.startsWith('udc.');
}

/**
 * 파일 전체에서 app.lookup("controlId").labelFn("text") 호출을 탐색하여
 * 라벨 텍스트를 모아 " / "로 결합한 문자열을 반환한다.
 * udcInfo가 주어지면 레지스트리의 labelFns로 정밀 탐색하고,
 * 호스트 파일에 없으면 defaultLabels 폴백. 못 찾으면 null 반환.
 */
function findUdcLabelFromFullContent(
  content: string,
  controlId: string,
  udcInfo?: UdcInfo,
): string | null {
  // Width 관련 함수 제외 — 실제 라벨 텍스트만 탐색
  const labelFns = udcInfo
    ? udcInfo.labelFns.filter(fn => !/[Ww]idth/i.test(fn))
    : null;

  const fnPattern =
    labelFns && labelFns.length > 0
      ? `(?:${labelFns.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
      : '(?:init|set)\\w*(?:[Ll]abel|[Tt]ext)\\w*';

  // labelArgIndex: 0 → 첫 번째 인수, 1 → 두 번째 인수
  const argIndex = udcInfo?.labelArgIndex ?? 0;
  const argPattern = argIndex === 0
    ? `\\s*\\(\\s*"([^"]+)"`         // 첫 번째 인수 캡처
    : `\\s*\\([^,]+,\\s*"([^"]+)"`; // 두 번째 인수 캡처

  const labelRe = new RegExp(
    `app\\.lookup\\("${controlId}"\\)\\.(${fnPattern})${argPattern}`,
    'g',
  );

  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(content)) !== null) {
    const fnName = m[1];
    if (/tooltip|button|title(?:bar)?/i.test(fnName)) continue;
    found.push(m[2]);
  }

  if (found.length > 0) return [...new Set(found)].join(' / ');

  // 호스트 파일에 라벨 호출 없음 → 레지스트리 defaultLabels 폴백
  if (udcInfo) {
    const defaults = Object.values(udcInfo.defaultLabels).filter(Boolean);
    if (defaults.length > 0) return [...new Set(defaults)].join(' / ');
  }

  return null;
}

/**
 * 컨테이너 선언 직후의 (function(container){…}) 본문을 중괄호 카운팅으로 추출
 */
function extractFunctionBody(content: string, containerDeclIdx: number): string {
  const funcMarker = '(function(container){';
  const start = content.indexOf(funcMarker, containerDeclIdx);
  if (start < 0 || start - containerDeclIdx > 2000) return '';

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
  return '';
}

/**
 * body 내에서 특정 varName에 바인딩된 중첩 함수 본문 추출
 * 패턴: (function(container){...})(varName)
 */
function extractNestedFunctionBody(body: string, varName: string): string {
  const endPattern = `})(${varName})`;
  const funcMarker = '(function(container){';
  let searchFrom = 0;

  while (searchFrom < body.length) {
    const endIdx = body.indexOf(endPattern, searchFrom);
    if (endIdx < 0) break;

    // 닫는 })(varName) 위치에서 역방향으로 대응하는 { 찾기
    let depth = 0;
    let i = endIdx;
    while (i >= 0) {
      if (body[i] === '}') depth++;
      else if (body[i] === '{') {
        depth--;
        if (depth === 0) {
          const checkStart = i - (funcMarker.length - 1);
          if (checkStart >= 0 && body.slice(checkStart, i + 1) === funcMarker) {
            return body.slice(i + 1, endIdx);
          }
          break;
        }
      }
      i--;
    }
    searchFrom = endIdx + 1;
  }
  return '';
}

/** 레이아웃/시스템 Container ID 패턴 (재귀 처리 제외 대상) */
const LAYOUT_CONTAINER_RE = /^(LAYOUT|SEARCHGROUP|CONDITIONGROUP|BATCH_GROUP|GRID_GROUP|CT_)/;

/**
 * 함수 본문에서 컨트롤 정보 파싱
 */
function parseBodyControls(body: string, fullContent: string): Array<{
  varName: string;
  controlId: string;
  controlType: string;
  fullType: string;
  labelValue: string;       // Output.value 또는 UDC label 또는 CheckBox.text
  colIndex: number;
  rowIndex: number;
  isReadOnly: boolean;
  isDisabled: boolean;
}> {
  const result: ReturnType<typeof parseBodyControls> = [];

  // 재귀 처리할 중첩 Container의 함수 본문을 먼저 추출하고,
  // outer body에서는 해당 블록을 제거하여 inner 컨트롤이 중복 파싱되지 않도록 함
  let outerBody = body;
  const nestedEntries: Array<{ rowIndex: number; colIndex: number; nestedBody: string }> = [];

  const containerScanRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+cpr\.controls\.Container\("([^"]+)"\)/g;
  let cs: RegExpExecArray | null;
  while ((cs = containerScanRe.exec(body)) !== null) {
    const varName = cs[1];
    const controlId = cs[2];
    if (LAYOUT_CONTAINER_RE.test(controlId)) continue;

    const addChildRe = new RegExp(
      `container\\.addChild\\(\\s*${varName}\\s*,\\s*\\{([^}]+)\\}`
    );
    const addMatch = addChildRe.exec(body);
    if (!addMatch) continue;
    const constraint = addMatch[1];
    const colIndex = parseInt(/"colIndex"\s*:\s*(\d+)/.exec(constraint)?.[1] ?? '0');
    const rowIndex = parseInt(/"rowIndex"\s*:\s*(\d+)/.exec(constraint)?.[1] ?? '0');

    const nestedBody = extractNestedFunctionBody(body, varName);
    if (!nestedBody) continue;

    nestedEntries.push({ rowIndex, colIndex, nestedBody });

    // outer body에서 해당 블록 제거 (공백으로 대체)
    const endPattern = `})(${varName})`;
    const funcMarker = '(function(container){';
    const endIdx = body.indexOf(endPattern);
    if (endIdx >= 0) {
      // 대응하는 시작 위치 찾기
      let depth = 0, i = endIdx;
      while (i >= 0) {
        if (body[i] === '}') depth++;
        else if (body[i] === '{') {
          depth--;
          if (depth === 0) {
            const checkStart = i - (funcMarker.length - 1);
            if (checkStart >= 0 && body.slice(checkStart, i + 1) === funcMarker) {
              const blockStart = checkStart - 1; // '(' before 'function'
              const blockEnd = endIdx + endPattern.length;
              outerBody = outerBody.slice(0, blockStart) + ' '.repeat(blockEnd - blockStart) + outerBody.slice(blockEnd);
              break;
            }
            break;
          }
        }
        i--;
      }
    }
  }

  // outer body (중첩 블록 제거된) 파싱
  const declRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+([\w.]+)\("([^"]+)"\)/g;
  let m: RegExpExecArray | null;

  while ((m = declRe.exec(outerBody)) !== null) {
    const varName = m[1];
    const fType = m[2];
    const controlId = m[3];
    const type = shortType(fType);

    // Container 타입은 이미 nestedEntries로 처리됨
    if (type === 'Container') continue;

    const addChildRe = new RegExp(
      `container\\.addChild\\(\\s*${varName}\\s*,\\s*\\{([^}]+)\\}`
    );
    const addMatch = addChildRe.exec(outerBody);
    if (!addMatch) continue;

    const constraint = addMatch[1];
    const colM = /"colIndex"\s*:\s*(\d+)/.exec(constraint);
    const rowM = /"rowIndex"\s*:\s*(\d+)/.exec(constraint);
    const colIndex = colM ? parseInt(colM[1]) : 0;
    const rowIndex = rowM ? parseInt(rowM[1]) : 0;

    let labelValue = '';

    if (type === 'Output') {
      const valRe = new RegExp(`${varName}\\.value\\s*=\\s*"([^"]+)"`);
      const valM = valRe.exec(outerBody);
      if (valM) labelValue = valM[1];
    } else if (type === 'CheckBox') {
      const textRe = new RegExp(`${varName}\\.text\\s*=\\s*"([^"]+)"`);
      const textM = textRe.exec(outerBody);
      if (textM) {
        labelValue = textM[1];
      } else {
        const lookupRe = new RegExp(
          `app\\.lookup\\("${controlId}"\\)\\.text\\s*=\\s*"([^"]+)"`,
        );
        const lookupM = lookupRe.exec(fullContent);
        if (lookupM) labelValue = lookupM[1];
      }
    } else if (isUdcType(fType) && !OUTPUT_LABEL_UDCS.has(type)) {
      const udcInfo = UDC_REGISTRY[type];
      const udcLabel = findUdcLabelFromFullContent(fullContent, controlId, udcInfo);
      labelValue = udcLabel ?? type;
    }

    const isReadOnly = new RegExp(`${varName}\\.readOnly\\s*=\\s*true`).test(outerBody);
    const isDisabled = new RegExp(`${varName}\\.enable\\s*=\\s*false`).test(outerBody);

    result.push({ varName, controlId, controlType: type, fullType: fType, labelValue, colIndex, rowIndex, isReadOnly, isDisabled });
  }

  // 중첩 컨테이너 내 컨트롤: 부모 rowIndex + 내부 rowIndex 오프셋 적용
  // - colIndex: 부모 col + 내부 col 오프셋 (기존 동일)
  // - rowIndex: 부모 row + 내부 row * 0.1
  //   → 단일 행 중첩 컨테이너(nc.rowIndex=0)는 기존과 동일
  //   → INFOGROUP 등 다중 행 중첩 컨테이너는 행이 분리되어 올바른 라벨 매칭
  for (const { rowIndex, colIndex, nestedBody } of nestedEntries) {
    const nestedControls = parseBodyControls(nestedBody, fullContent);
    for (const nc of nestedControls) {
      result.push({
        ...nc,
        rowIndex: rowIndex + nc.rowIndex * 0.1,
        colIndex: colIndex + (nc.colIndex + 1) * 0.01,
      });
    }
  }

  return result;
}

/**
 * 파싱된 컨트롤 목록에서 라벨-입력쌍 구성
 */
function buildPairs(controls: ReturnType<typeof parseBodyControls>): ConditionControlInfo[] {
  const rowMap = new Map<number, {
    labels: typeof controls;
    inputs: typeof controls;
  }>();

  for (const ctrl of controls) {
    if (!rowMap.has(ctrl.rowIndex)) rowMap.set(ctrl.rowIndex, { labels: [], inputs: [] });
    const row = rowMap.get(ctrl.rowIndex)!;
    if (ctrl.controlType === 'Output') {
      row.labels.push(ctrl);
    } else if (!SKIP_TYPES.has(ctrl.controlType)) {
      row.inputs.push(ctrl);
    }
  }

  const result: ConditionControlInfo[] = [];

  for (const [, row] of rowMap) {
    row.labels.sort((a, b) => a.colIndex - b.colIndex);
    row.inputs.sort((a, b) => a.colIndex - b.colIndex);

    // CLX 오버레이 패턴 제거: 동일 행에서 같은 라벨에 매핑된 컨트롤(InputBox·ComboBox·PatisCombo 겹침)은 첫 번째만 유지
    const seenLabelsInRow = new Set<string>();

    for (const input of row.inputs) {
      let labelText: string;

      if ((isUdcType(input.fullType) && !OUTPUT_LABEL_UDCS.has(input.controlType))
          || input.controlType === 'CheckBox') {
        // UDC 또는 CheckBox: 자체 라벨 우선
        if (input.labelValue) {
          labelText = input.labelValue;
        } else {
          // 자체 라벨 없음(text가 빈 문자열 등) → 같은 행 Output 중 가장 가까운 것 사용
          const closest = row.labels
            .slice()
            .sort((a, b) =>
              Math.abs(a.colIndex - input.colIndex) - Math.abs(b.colIndex - input.colIndex)
            )[0];
          labelText = closest?.labelValue ?? input.controlId;
        }
      } else {
        // 일반 컨트롤: 같은 행에서 왼쪽에 가장 가까운 Output 라벨
        const label = row.labels
          .filter(l => l.colIndex < input.colIndex)
          .slice(-1)[0];
        labelText = label?.labelValue ?? input.controlId;

        // 왼쪽 Output을 못 찾은 경우 (중첩 컨테이너로 인해 col=0으로 파싱됨):
        // 1) T_[controlId] 이름의 Output 탐색 (같은 행 전체)
        if (labelText === input.controlId || isSeparatorLabel(labelText)) {
          const tIdLabel = row.labels.find(
            l => l.controlId === `T_${input.controlId}`
          )?.labelValue;
          if (tIdLabel) {
            labelText = tIdLabel;
          } else {
            // 2) T_[base] 탐색 (범위 쌍의 시작 컨트롤 Output)
            const base = input.controlId.replace(/_(STT|BGN|BGNG|FROM|ST|END|TO|FIN|ED)$/i, '');
            const tBaseLabel = row.labels.find(
              l => l.controlId.startsWith(`T_${base}`) && !isSeparatorLabel(l.labelValue)
            )?.labelValue;
            if (tBaseLabel) {
              labelText = tBaseLabel;
            } else {
              // 3) 중첩 컨테이너 내 컨트롤: 중간 세그먼트 제거 후 concept 문자열로 Output 탐색
              // 예) S_BGNG_GRDN_AVG → concept=GRDN_AVG → 같은 행 Output ID에 GRDN_AVG 포함하는 것
              const conceptStr = input.controlId.replace(/^S_(?:BGNG|BGN|STT|END|TO)_/i, '');
              if (conceptStr !== input.controlId) {
                const conceptLabel = row.labels.find(
                  l => !isSeparatorLabel(l.labelValue) && l.controlId.includes(conceptStr)
                )?.labelValue;
                if (conceptLabel) labelText = conceptLabel;
              }
              // 4) 최후 폴백: 같은 행에 단 하나의 유효 Output이 있으면 그것을 사용
              if (labelText === input.controlId) {
                const validOutputs = row.labels.filter(
                  l => !isSeparatorLabel(l.labelValue) && l.labelValue
                );
                if (validOutputs.length === 1) labelText = validOutputs[0].labelValue;
              }
            }
          }
        }
      }

      if (seenLabelsInRow.has(labelText)) continue;
      seenLabelsInRow.add(labelText);

      result.push({
        controlId: input.controlId,
        labelText,
        description: '',
        controlType: input.controlType,
        inputType: (input.isReadOnly || input.isDisabled) ? '표시' : '입력',
      });
    }
  }

  // 화면상 순서(rowIndex → colIndex)로 정렬
  result.sort((a, b) => {
    const ca = controls.find(c => c.controlId === a.controlId);
    const cb = controls.find(c => c.controlId === b.controlId);
    if (!ca || !cb) return 0;
    if (ca.rowIndex !== cb.rowIndex) return ca.rowIndex - cb.rowIndex;
    return ca.colIndex - cb.colIndex;
  });

  // 범위 쌍 (STT/BGN ↔ END) "(시작)"/"(종료)" 접미사 처리
  applyRangePairSuffixes(result);

  return result;
}

/** 구분자 라벨 여부 ("~", "-", "/" 등) */
function isSeparatorLabel(label: string): boolean {
  return /^[~\-\/|·•]+$/.test(label.trim());
}

/**
 * 같은 기저명을 공유하는 STT/END 쌍에 "(시작)"/"(종료)" 접미사 부여
 * 패턴1: 접미사 — S_CHG_STT + S_CHG_END → "변경기간(시작)", "변경기간(종료)"
 * 패턴2: 중간세그먼트 — S_BGNG_GRDN_AVG + S_END_GRDN_AVG → "평점평균(시작)", "평점평균(종료)"
 */
function applyRangePairSuffixes(pairs: ConditionControlInfo[]): void {
  const START_TOKENS = ['STT', 'BGN', 'BGNG', 'FROM', 'START', 'ST'];
  const END_TOKENS   = ['END', 'TO', 'FIN', 'ED'];
  const processed = new Set<string>();

  for (const item of pairs) {
    if (processed.has(item.controlId)) continue;

    let endItem: ConditionControlInfo | undefined;

    // 패턴1: 접미사 _STT/_BGN/_BGNG → _END
    for (const sv of START_TOKENS) {
      const suffixRe = new RegExp(`_(${sv})$`, 'i');
      if (!suffixRe.test(item.controlId)) continue;
      const base = item.controlId.replace(suffixRe, '');
      endItem = pairs.find(p =>
        !processed.has(p.controlId) &&
        END_TOKENS.some(ev => p.controlId === `${base}_${ev}`)
      );
      if (endItem) break;
    }

    // 패턴2: 중간 세그먼트 _BGNG_/_STT_ → _END_
    if (!endItem) {
      for (const sv of START_TOKENS) {
        const midRe = new RegExp(`_(${sv})_`, 'i');
        if (!midRe.test(item.controlId)) continue;
        endItem = pairs.find(p =>
          !processed.has(p.controlId) &&
          END_TOKENS.some(ev => p.controlId === item.controlId.replace(midRe, `_${ev}_`))
        );
        if (endItem) break;
      }
    }

    if (!endItem) continue;

    // 유효한 라벨 선택 (구분자·controlId 형태 제외)
    const validLabel = [item.labelText, endItem.labelText].find(
      l => l && !isSeparatorLabel(l) && !/^S_/.test(l) && l.trim().length > 0
    );
    if (!validLabel) continue;

    item.labelText = `${validLabel}(시작)`;
    endItem.labelText = `${validLabel}(종료)`;
    processed.add(item.controlId);
    processed.add(endItem.controlId);
  }
}

/**
 * .clx.js 파일 내용에서 조회조건/처리조건 그룹 목록 파싱
 */
export function parseConditionGroups(content: string): ConditionGroupInfo[] {
  const groups: ConditionGroupInfo[] = [];

  const containerRe = /new\s+cpr\.controls\.Container\("((SEARCHGROUP|CONDITIONGROUP|BATCH_GROUP)(\d+))"\)/g;
  let m: RegExpExecArray | null;

  while ((m = containerRe.exec(content)) !== null) {
    const groupId = m[1];
    const groupType: ConditionGroupInfo['groupType'] =
      m[2] === 'SEARCHGROUP' ? '조회조건'
      : m[2] === 'CONDITIONGROUP' ? '처리조건'
      : '일괄처리';

    const body = extractFunctionBody(content, m.index);
    if (!body) continue;

    // BATCH_GROUP 내 PatisTitleBar title 추출
    let groupTitle: string | undefined;
    const titleBarRe = /new\s+udc\.common\.PatisTitleBar\("[^"]+"\)/;
    const tbMatch = titleBarRe.exec(body);
    if (tbMatch) {
      const afterTb = body.slice(tbMatch.index, tbMatch.index + 600);
      const titleMatch = /\.title\s*=\s*"([^"]+)"/.exec(afterTb);
      if (titleMatch) groupTitle = titleMatch[1];
    }

    const controls = parseBodyControls(body, content);
    const pairs = buildPairs(controls);

    if (pairs.length > 0 || groupTitle) {
      groups.push({ groupId, groupType, title: groupTitle, controls: pairs });
    }
  }

  return groups;
}
