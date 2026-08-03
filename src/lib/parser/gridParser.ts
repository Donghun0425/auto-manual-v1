/**
 * 그리드 정보 파서
 * - PatisTitleBar에 바인딩된 그리드 추출
 * - PatisGrid.initCreate 호출된 그리드 추출
 * - 그리드 옵션 (체크박스, 행번호, 상태, 정렬) 추출
 * - 그리드 헤더/detail 컬럼 정보 추출
 */
import type { GridInfo, GridColumnInfo } from '@/types';
import { normalizeLabel } from '../utils.ts';
import { createLayoutVisibilityResolver } from './visibility.ts';

/** 정규식 특수문자 이스케이프 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ?ㅻ뜑 ?띿뒪??JS ?댁뒪耳?댄봽 ?쒗??\r\n ?? ??怨듬갚 移섑솚
 */
function cleanHeaderText(text: string): string {
  return normalizeLabel(text);
}

/**
 * Container("GRID_GROUP...") 선언 이후 (function(container){...}) 본문 추출
 */
function extractContainerBody(content: string, fromIndex: number, maxDistance = 10000): string | null {
  const funcMarker = '(function(container){';
  const start = content.indexOf(funcMarker, fromIndex);
  if (start < 0 || start - fromIndex > maxDistance) return null;
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(start + funcMarker.length, i);
    }
  }
  return null;
}

/**
 * PatisTitleBar(CT_GRIDTITLENN) → 그리드 ID 매핑 추출
 *
 * 탐색 전략 (우선순위 순):
 * 1. GRID_GROUP 컨테이너 본문 내 PatisTitleBar title + app.lookup("DG_...") 조합
 * 2. CT_GRIDTITLE{N} 선언부 varName + varName.setGrid/target 패턴으로 실제 그리드 ID
 * 3. 기존 폴백: CT_GRIDTITLE{N} 접미 숫자 → DG_GRID{N} 추정
 */
function parseGridTitleMap(content: string): Map<string, string> {
  const titleMap = new Map<string, string>();

  // ── 전략 1: GRID_GROUP 컨테이너 본문에서 titleBar title + 그리드 ID 연결 ─────
  // [^"]* : GRID_GROUP, GRID_GROUP01 등 숫자 접미사 없는 경우도 매치
  const gridGroupRe = /new\s+cpr\.controls\.Container\("(GRID_GROUP[^"]*)"\)/g;
  let gm: RegExpExecArray | null;
  while ((gm = gridGroupRe.exec(content)) !== null) {
    const body = extractContainerBody(content, gm.index);
    if (!body) continue;

    const tbRe = /var\s+\w+\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+udc\.common\.PatisTitleBar\("(CT_GRIDTITLE\d+)"\)/g;
    let tbM: RegExpExecArray | null;
    while ((tbM = tbRe.exec(body)) !== null) {
      const nextTbIndex = body.slice(tbRe.lastIndex).search(/new\s+udc\.common\.PatisTitleBar\("/);
      const titleScopeEnd = nextTbIndex >= 0 ? tbRe.lastIndex + nextTbIndex : body.length;
      const afterTb = body.slice(tbM.index, Math.min(titleScopeEnd, tbM.index + 1200));
      const titleM = /\.title\s*=\s*"([^"]+)"/.exec(afterTb);
      if (!titleM) continue;
      const title = titleM[1];

      const lookupM = /app\.lookup\("(DG_[^"]+)"\)/.exec(afterTb);
      if (lookupM) {
        titleMap.set(lookupM[1], title);
        continue;
      }

      const gridDeclM = /new\s+cpr\.controls\.Grid\("(DG_[^"]+)"\)/.exec(afterTb);
      if (gridDeclM) titleMap.set(gridDeclM[1], title);
    }
  }

  // ── 전략 2: CT_GRIDTITLE{N} varName + varName.setGrid / .target 바인딩 ───────
  // 전략 1에서 매핑되지 않은 그리드를 보완
  const tbDeclRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+udc\.common\.PatisTitleBar\("(CT_GRIDTITLE\d+)"\)/g;
  let td: RegExpExecArray | null;
  while ((td = tbDeclRe.exec(content)) !== null) {
    const varName = td[1];
    const afterDecl = content.slice(td.index, td.index + 800);
    const titleM = /\.title\s*=\s*"([^"]+)"/.exec(afterDecl);
    if (!titleM) continue;
    const title = titleM[1];

    // varName.setGrid(app.lookup("DG_...")) 또는 varName.target = app.lookup("DG_...")
    const bindRe = new RegExp(
      `${varName}\\s*\\.\\s*(?:setGrid|target)\\s*[=(]\\s*app\\.lookup\\("(DG_[^"]+)"\\)`
    );
    const bindM = bindRe.exec(content.slice(td.index, td.index + 1500));
    if (bindM) {
      if (!titleMap.has(bindM[1])) titleMap.set(bindM[1], title);
      continue;
    }

    // 같은 800자 이내에 app.lookup("DG_...") 단독 참조
    const nearLookupM = /app\.lookup\("(DG_[^"]+)"\)/.exec(afterDecl);
    if (nearLookupM && !titleMap.has(nearLookupM[1])) titleMap.set(nearLookupM[1], title);
  }

  // ── 전략 3: 폴백 — 접미 숫자로 DG_GRID{N} 추정, 미매핑 항목만 보완 ──────────
  const tbPattern = /new udc\.common\.PatisTitleBar\("(CT_GRIDTITLE\d+)"\)/g;
  let match: RegExpExecArray | null;
  while ((match = tbPattern.exec(content)) !== null) {
    const tbId = match[1];
    const afterCreation = content.slice(match.index, match.index + 500);
    const titleMatch = /\.title\s*=\s*"([^"]+)"/.exec(afterCreation);
    if (!titleMatch) continue;
    const numMatch = /(\d+)$/.exec(tbId);
    if (!numMatch) continue;
    const inferredId = `DG_GRID${numMatch[1]}`;
    if (!titleMap.has(inferredId)) titleMap.set(inferredId, titleMatch[1]);
  }

  return titleMap;
}

interface HeaderEntry {
  id: number;
  rowIndex: number;
  colIndex: number;
  rowSpan: number;
  colSpan: number;
  text: string;
}

interface HeaderCellInfo {
  text: string;
  terminalEntryId: number;
  isMergedLeaf: boolean;
}

type HeaderCellMap = Map<number, HeaderCellInfo>;

function parseConstraintNumber(constraint: string, key: string, fallback: number): number {
  const match = new RegExp(`"${key}"\\s*:\\s*(\\d+)`).exec(constraint);
  return match ? parseInt(match[1], 10) : fallback;
}

/** PatisUtils.isNullThen(..., "DEFAULT") 에서 변수의 기본값을 찾는다. */
function findVariableDefault(content: string, variableName: string): string {
  const assignmentRe = new RegExp(
    `${escapeRegex(variableName)}\\s*=\\s*PatisUtils\\.isNullThen\\(`,
    'g',
  );
  let match: RegExpExecArray | null;

  while ((match = assignmentRe.exec(content)) !== null) {
    const statementEnd = content.indexOf(');', match.index);
    if (statementEnd < 0 || statementEnd - match.index > 1000) continue;

    const statement = content.slice(match.index, statementEnd + 2);
    const defaultMatch = /,\s*"((?:[^"\\]|\\.)*)"\s*\);$/.exec(statement);
    if (defaultMatch) return cleanHeaderText(defaultMatch[1]);
  }

  return '';
}

/**
 * 빈 헤더 안의 Output 컨트롤에 런타임으로 넣는 표시값을 해석한다.
 * 예: g_menuSe1의 기본값 AAC → D_TASK_SE_NM.putValue("회계")
 */
function resolveHeaderControlText(content: string, cellBody: string): string {
  const directValueMatch = /\w+\.(?:value|text)\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(cellBody);
  if (directValueMatch) {
    const directValue = cleanHeaderText(directValueMatch[1]);
    if (directValue) return directValue;
  }

  const controlMatch = /new\s+cpr\.controls\.Output\("([^"]+)"\)/.exec(cellBody);
  if (!controlMatch) return '';

  const controlId = controlMatch[1];
  const escapedControlId = escapeRegex(controlId);
  const conditionalValueRe = new RegExp(
    `if\\s*\\(\\s*(\\w+)\\s*={2,3}\\s*"([^"]+)"\\s*\\)\\s*\\{?[\\s\\S]{0,300}?` +
      `app\\.lookup\\("${escapedControlId}"\\)\\.putValue\\(\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*\\)`,
    'g',
  );
  const conditionalValues: Array<{ variableName: string; conditionValue: string; text: string }> = [];
  let conditionalMatch: RegExpExecArray | null;

  while ((conditionalMatch = conditionalValueRe.exec(content)) !== null) {
    conditionalValues.push({
      variableName: conditionalMatch[1],
      conditionValue: conditionalMatch[2],
      text: cleanHeaderText(conditionalMatch[3]),
    });
  }

  for (const value of conditionalValues) {
    const defaultValue = findVariableDefault(content, value.variableName);
    if (defaultValue && defaultValue === value.conditionValue) return value.text;
  }

  const putValueRe = new RegExp(
    `app\\.lookup\\("${escapedControlId}"\\)\\.putValue\\(\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*\\)`,
    'g',
  );
  const values = new Set<string>();
  let putValueMatch: RegExpExecArray | null;
  while ((putValueMatch = putValueRe.exec(content)) !== null) {
    const value = cleanHeaderText(putValueMatch[1]);
    if (value) values.add(value);
  }

  return values.size === 1 ? Array.from(values)[0] : '';
}

/**
 * 헤더 섹션에서 colIndex → 헤더텍스트 맵 추출
 * - rowSpan/colSpan을 매트릭스로 펼쳐 다단 병합 헤더 경로를 구성한다.
 * - 동일 병합 셀이 여러 행에 전파된 경우에는 한 번만 사용한다.
 */
function parseHeaderCells(headerSection: string, content: string): HeaderCellMap {
  const constraintRe =
    /"constraint"\s*:\s*\{([^}]+)\}\s*,\s*"configurator"\s*:\s*function\s*\(cell\)\s*\{/g;
  let cMatch: RegExpExecArray | null;

  const entries: HeaderEntry[] = [];

  while ((cMatch = constraintRe.exec(headerSection)) !== null) {
    const constraintStr = cMatch[1];
    const colIndex = parseConstraintNumber(constraintStr, "colIndex", -1);
    if (colIndex < 0) continue;

    // configurator 본문: 다음 "constraint" 직전까지
    const bodyStart = cMatch.index + cMatch[0].length;
    const nextConstraint = headerSection.indexOf('"constraint"', bodyStart);
    const bodyEnd = nextConstraint > bodyStart ? nextConstraint : bodyStart + 2000;
    const body = headerSection.slice(bodyStart, Math.min(bodyEnd, bodyStart + 2000));

    const textM = /cell\.text\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(body);
    const staticText = textM ? cleanHeaderText(textM[1]) : '';
    const text = staticText || resolveHeaderControlText(content, body);
    if (!text) continue;

    entries.push({
      id: entries.length,
      rowIndex: parseConstraintNumber(constraintStr, "rowIndex", 0),
      colIndex,
      rowSpan: parseConstraintNumber(constraintStr, "rowSpan", 1),
      colSpan: parseConstraintNumber(constraintStr, "colSpan", 1),
      text,
    });
  }

  const headerCells: HeaderCellMap = new Map();
  const matrix = new Map<number, Map<number, { id: number; text: string }>>();
  const colIndexes = new Set<number>();
  const rowIndexes = new Set<number>();

  for (const entry of entries) {
    for (let row = entry.rowIndex; row < entry.rowIndex + entry.rowSpan; row++) {
      rowIndexes.add(row);
      let rowMap = matrix.get(row);
      if (!rowMap) {
        rowMap = new Map();
        matrix.set(row, rowMap);
      }
      for (let col = entry.colIndex; col < entry.colIndex + entry.colSpan; col++) {
        colIndexes.add(col);
        rowMap.set(col, { id: entry.id, text: entry.text });
      }
    }
  }

  const sortedRows = Array.from(rowIndexes).sort((a, b) => a - b);
  for (const col of Array.from(colIndexes).sort((a, b) => a - b)) {
    const parts: string[] = [];
    const usedEntryIds = new Set<number>();
    let terminalEntry: HeaderEntry | undefined;

    for (const row of sortedRows) {
      const cell = matrix.get(row)?.get(col);
      if (!cell || usedEntryIds.has(cell.id)) continue;
      parts.push(cell.text);
      usedEntryIds.add(cell.id);
      terminalEntry = entries[cell.id];
    }

    if (parts.length > 0 && terminalEntry) {
      headerCells.set(col, {
        text: parts.join("-"),
        terminalEntryId: terminalEntry.id,
        isMergedLeaf: false,
      });
    }
  }

  for (const header of headerCells.values()) {
    const entry = entries[header.terminalEntryId];
    header.isMergedLeaf = entry.colSpan > 1 && Array.from(
      { length: entry.colSpan },
      (_, offset) => entry.colIndex + offset,
    ).every((col) => headerCells.get(col)?.terminalEntryId === entry.id);
  }

  return headerCells;
}

/**
 * detail 섹션에서 각 셀 정보 추출
 * - constraint의 colIndex / rowIndex 파싱
 * - cell.control이 있는 셀은 포함
 * - cell.control이 없어도 columnName과 표시 헤더가 있으면 기본 표시 셀로 포함
 * - 다음 셀의 "constraint" 키 직전까지를 본문으로 사용 (cross-cell 방지)
 */
function parseDetailCells(
  detailSection: string,
  headerCells: HeaderCellMap
): GridColumnInfo[] {
  const columns: Array<GridColumnInfo & {
    colIndex: number;
    headerGroupId?: number;
    isMergedHeaderLeaf: boolean;
  }> = [];
  const constraintRe =
    /"constraint"\s*:\s*\{([^}]+)\}\s*,\s*"configurator"\s*:\s*function\s*\(cell\)\s*\{/g;
  let cMatch: RegExpExecArray | null;

  while ((cMatch = constraintRe.exec(detailSection)) !== null) {
    const constraintStr = cMatch[1];
    const bodyStart = cMatch.index + cMatch[0].length;

    // rowIndex 확인 (0인 행만 처리)
    const riM = /"rowIndex":\s*(\d+)/.exec(constraintStr);
    if (riM && parseInt(riM[1]) !== 0) continue;

    // colIndex 추출
    const ciM = /"colIndex":\s*(\d+)/.exec(constraintStr);
    if (!ciM) continue;
    const colIndex = parseInt(ciM[1]);

    // 본문 스코프: 다음 "constraint" 키 직전까지 (cross-cell 방지)
    const nextConstraint = detailSection.indexOf('"constraint"', bodyStart);
    const bodyEnd = nextConstraint > bodyStart ? nextConstraint : bodyStart + 2000;
    const body = detailSection.slice(bodyStart, Math.min(bodyEnd, bodyStart + 2000));

    // columnName
    const colNmM = /cell\.columnName\s*=\s*"([^"]+)"/.exec(body);
    const columnName = colNmM ? colNmM[1] : '';
    const header = headerCells.get(colIndex);
    const hasCellControl = /cell\.control\s*=/.test(body.slice(0, 500));

    // 헤더 없는 기술·숨김 컬럼은 기존처럼 제외하되,
    // 명시적인 헤더와 columnName이 있는 기본 그리드 셀은 표시 항목으로 인정한다.
    if (!hasCellControl && (!columnName || !header?.text)) continue;

    // 而⑦듃濡????
    const ctM = /new cpr\.controls\.([\w.]+)\(/.exec(body);
    const controlType = ctM ? (ctM[1].split('.').pop() ?? ctM[1]) : '';

    // readOnly / enable 분석
    const hasReadOnlyTrue  = /\.readOnly\s*=\s*true/.test(body);
    const hasEnableFalse   = /\.enable[d]?\s*=\s*false/.test(body);
    const hasReadOnlyExpr  = /\.bind\(["']readOnly["']\)\.toExpression/.test(body);
    const hasEnableExpr    = /\.bind\(["']enable[d]?["']\)\.toExpression/.test(body);

    // 용도 결정
    let purpose: '표시' | '입력' | '표시 또는 입력';
    if (!controlType || controlType === 'Output' || controlType === 'TreeCell') {
      purpose = '표시';
    } else if (hasReadOnlyExpr || hasEnableExpr) {
      purpose = '표시 또는 입력';
    } else if (hasReadOnlyTrue || hasEnableFalse) {
      purpose = '표시';
    } else {
      purpose = '입력';
    }

    const headerText = header?.text ?? columnName;
    if (!headerText && !columnName) continue;

    columns.push({
      colIndex,
      headerGroupId: header?.terminalEntryId,
      isMergedHeaderLeaf: header?.isMergedLeaf ?? false,
      columnName,
      headerText: headerText || columnName,
      description: '',
      controlType: controlType || '-',
      purpose,
    });
  }

  const sortedColumns = columns.sort((a, b) => a.colIndex - b.colIndex);
  const collapsedColumns: typeof sortedColumns = [];

  for (let index = 0; index < sortedColumns.length;) {
    const first = sortedColumns[index];
    if (!first.isMergedHeaderLeaf || first.headerGroupId === undefined) {
      collapsedColumns.push(first);
      index++;
      continue;
    }

    let groupEnd = index + 1;
    while (
      groupEnd < sortedColumns.length &&
      sortedColumns[groupEnd].headerGroupId === first.headerGroupId &&
      sortedColumns[groupEnd].headerText === first.headerText
    ) {
      groupEnd++;
    }
    const group = sortedColumns.slice(index, groupEnd);
    if (group.length <= 1) {
      collapsedColumns.push(first);
      index++;
      continue;
    }

    const boundColumns = group.filter((column) => column.columnName);
    const meaningfulColumns = boundColumns.length > 0 ? boundColumns : group;
    const columnNames = Array.from(new Set(meaningfulColumns.map((column) => column.columnName).filter(Boolean)));
    const controlTypes = Array.from(new Set(meaningfulColumns.map((column) => column.controlType).filter(Boolean)));
    const purposes = new Set(meaningfulColumns.map((column) => column.purpose));
    const descriptions = Array.from(new Set(group.map((column) => column.description).filter(Boolean)));

    collapsedColumns.push({
      ...first,
      columnName: columnNames.join(', '),
      controlType: controlTypes.join(' / ') || '-',
      purpose: purposes.size === 1 ? meaningfulColumns[0].purpose : '표시 또는 입력',
      description: descriptions.join(' '),
    });

    index = groupEnd;
  }

  return collapsedColumns.map((column) => ({
    columnName: column.columnName,
    headerText: column.headerText,
    description: column.description,
    controlType: column.controlType,
    purpose: column.purpose,
  }));
}

/**
 * 특정 그리드의 헤더/detail 컬럼 정보 추출
 */
function parseGridColumns(content: string, gridId: string): GridColumnInfo[] {
  const gridStartRegex = new RegExp(`new cpr\\.controls\\.Grid\\("${escapeRegex(gridId)}"\\)`);
  const gridStartMatch = gridStartRegex.exec(content);
  if (!gridStartMatch) return [];

  const gridStart = gridStartMatch.index;
  const afterGrid = content.slice(gridStart + gridStartMatch[0].length);
  const nextGridMatch = /new cpr\.controls\.Grid\(/.exec(afterGrid);
  const gridEnd = nextGridMatch
    ? gridStart + gridStartMatch[0].length + nextGridMatch.index
    : content.length;

  const gridSection = content.slice(gridStart, gridEnd);

  const headerStart = gridSection.indexOf('"header"');
  const detailStart = gridSection.indexOf('"detail"');
  if (headerStart < 0 || detailStart < 0) return [];

  const headerSection = gridSection.slice(headerStart, detailStart);
  const detailSection = gridSection.slice(detailStart);

  const headerCells = parseHeaderCells(headerSection, content);
  return parseDetailCells(detailSection, headerCells);
}

/**
 * 그리드 정보를 추출
 * @param content - .clx.js 파일 내용
 * @returns 그리드 정보 배열
 */
export function parseGrids(content: string): GridInfo[] {
  const grids = new Map<string, GridInfo>();
  const titleMap = parseGridTitleMap(content);
  const layoutVisibility = createLayoutVisibilityResolver(content);

  const initPattern = /PatisGrid\.initCreate\(app\.lookup\("([^"]+)"\)\)/g;
  let match: RegExpExecArray | null;

  while ((match = initPattern.exec(content)) !== null) {
    const gridId = match[1];
    if (!grids.has(gridId)) {
      // visible = false 로 명시된 그리드는 화면에 노출되지 않으므로 제외
      if (!layoutVisibility.isVisible(gridId)) continue;
      grids.set(gridId, {
        gridId,
        title: titleMap.get(gridId) ?? '',
        isBound: false,
        hasCheckbox: false,
        hasRowNumber: false,
        hasState: false,
        sortable: false,
        columns: [],
      });
    }
  }

  const bindPattern = /initBindObject\(app\.lookup\("([^"]+)"\)\)/g;
  while ((match = bindPattern.exec(content)) !== null) {
    const gridId = match[1];
    const grid = grids.get(gridId);
    if (grid) grid.isBound = true;
  }

  for (const [gridId, grid] of grids) {
    const cbMatch = content.match(
      new RegExp(`PatisGrid\\.initAddColumn\\(app\\.lookup\\("${gridId}"\\),\\s*"checkbox",\\s*(true|false)\\)`)
    );
    if (cbMatch) grid.hasCheckbox = cbMatch[1] === 'true';

    const rnMatch = content.match(
      new RegExp(`PatisGrid\\.initAddColumn\\(app\\.lookup\\("${gridId}"\\),\\s*"rownumber",\\s*(true|false)\\)`)
    );
    if (rnMatch) grid.hasRowNumber = rnMatch[1] === 'true';

    const stMatch = content.match(
      new RegExp(`PatisGrid\\.initAddColumn\\(app\\.lookup\\("${gridId}"\\),\\s*"state",\\s*(true|false)\\)`)
    );
    if (stMatch) grid.hasState = stMatch[1] === 'true';

    const sortMatch = content.match(
      new RegExp(`PatisGrid\\.initSortable\\(app\\.lookup\\("${gridId}"\\),\\s*(true|false)\\s*\\)`)
    );
    if (sortMatch) grid.sortable = sortMatch[1] === 'true';

    grid.columns = parseGridColumns(content, gridId);
  }

  return Array.from(grids.values());
}

