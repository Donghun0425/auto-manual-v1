/**
 * 그리드 정보 파서
 * - PatisTitleBar에 바인딩된 그리드 추출
 * - PatisGrid.initCreate 호출된 그리드 추출
 * - 그리드 옵션 (체크박스, 행번호, 상태, 정렬) 추출
 * - 그리드 헤더/detail 컬럼 정보 추출
 */
import { GridInfo, GridColumnInfo } from '@/types';
import { normalizeLabel } from '@/lib/utils';

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

    // body 내 PatisTitleBar title 추출
    const tbM = /new\s+udc\.common\.PatisTitleBar\("[^"]+"\)/.exec(body);
    if (!tbM) continue;
    const afterTb = body.slice(tbM.index, tbM.index + 600);
    const titleM = /\.title\s*=\s*"([^"]+)"/.exec(afterTb);
    if (!titleM) continue;
    const title = titleM[1];

    // body 내 app.lookup("DG_...") 로 그리드 ID 탐색
    const lookupM = /app\.lookup\("(DG_[^"]+)"\)/.exec(body);
    if (lookupM) {
      titleMap.set(lookupM[1], title);
      continue;
    }
    // app.lookup 없으면 new cpr.controls.Grid("DG_...") 탐색
    const gridDeclM = /new\s+cpr\.controls\.Grid\("(DG_[^"]+)"\)/.exec(body);
    if (gridDeclM) titleMap.set(gridDeclM[1], title);
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

/**
 * 헤더 섹션에서 colIndex → 헤더텍스트 맵 추출
 *
 * [개선] configurator 블록 범위 기반 파싱 + colSpan 전파
 * - 각 "constraint"+"configurator" 블록을 분리, 블록 내에서만 cell.text 탐색
 * - colSpan이 있는 그룹 헤더(rowIndex=0)는 span 범위 내 모든 colIndex에 전파
 * - rowIndex >= 1의 세부 헤더가 그룹 헤더를 덮어씀 (last write wins)
 */
function parseHeaderCells(headerSection: string): Map<number, string> {
  // 1단계: 모든 블록 수집
  const constraintRe =
    /"constraint"\s*:\s*\{([^}]+)\}\s*,\s*"configurator"\s*:\s*function\s*\(cell\)\s*\{/g;
  let cMatch: RegExpExecArray | null;

  // 그룹 헤더 (rowIndex=0, colSpan 포함) 및 세부 헤더 (rowIndex>=1) 분리 저장
  const groupEntries: Array<{ colIndex: number; colSpan: number; text: string }> = [];
  const subEntries: Array<{ colIndex: number; text: string }> = [];

  while ((cMatch = constraintRe.exec(headerSection)) !== null) {
    const constraintStr = cMatch[1];

    const ciM = /"colIndex":\s*(\d+)/.exec(constraintStr);
    if (!ciM) continue;
    const colIndex = parseInt(ciM[1]);

    const riM = /"rowIndex":\s*(\d+)/.exec(constraintStr);
    const rowIndex = riM ? parseInt(riM[1]) : 0;

    const spanM = /"colSpan":\s*(\d+)/.exec(constraintStr);
    const colSpan = spanM ? parseInt(spanM[1]) : 1;

    // configurator 본문: 다음 "constraint" 직전까지
    const bodyStart = cMatch.index + cMatch[0].length;
    const nextConstraint = headerSection.indexOf('"constraint"', bodyStart);
    const bodyEnd = nextConstraint > bodyStart ? nextConstraint : bodyStart + 2000;
    const body = headerSection.slice(bodyStart, Math.min(bodyEnd, bodyStart + 2000));

    const textM = /cell\.text\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(body);
    if (!textM) continue;
    const text = cleanHeaderText(textM[1]);
    if (!text) continue; // 빈 문자열 (설계자가 의도적으로 비운 경우) 스킵

    if (rowIndex === 0) {
      groupEntries.push({ colIndex, colSpan, text });
    } else {
      subEntries.push({ colIndex, text });
    }
  }

  const headerCells = new Map<number, string>();

  // 2단계: 그룹 헤더를 colSpan 범위 전체에 적용 (가장 낮은 우선순위)
  for (const { colIndex, colSpan, text } of groupEntries) {
    for (let ci = colIndex; ci < colIndex + colSpan; ci++) {
      if (!headerCells.has(ci)) {
        headerCells.set(ci, text);
      }
    }
  }

  // 3단계: 세부 헤더(rowIndex>=1)로 덮어씀 (높은 우선순위)
  for (const { colIndex, text } of subEntries) {
    headerCells.set(colIndex, text);
  }

  return headerCells;
}

/**
 * detail 섹션에서 각 셀 정보 추출
 * - constraint의 colIndex / rowIndex 파싱
 * - cell.columnName 여부 관계없이 cell.control 있으면 포함
 * - 다음 셀의 "constraint" 키 직전까지를 본문으로 사용 (cross-cell 방지)
 */
function parseDetailCells(
  detailSection: string,
  headerCells: Map<number, string>
): GridColumnInfo[] {
  const columns: GridColumnInfo[] = [];
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

    // cell.control 없으면 스킵
    if (!/cell\.control\s*=/.test(body.slice(0, 500))) continue;

    // columnName
    const colNmM = /cell\.columnName\s*=\s*"([^"]+)"/.exec(body);
    const columnName = colNmM ? colNmM[1] : '';

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

    const headerText = headerCells.get(colIndex) ?? columnName;
    if (!headerText && !columnName) continue;

    columns.push({
      columnName,
      headerText: headerText || columnName,
      description: '',
      controlType: controlType || '-',
      purpose,
    });
  }

  return columns;
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

  const headerCells = parseHeaderCells(headerSection);
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

  const initPattern = /PatisGrid\.initCreate\(app\.lookup\("([^"]+)"\)\)/g;
  let match: RegExpExecArray | null;

  while ((match = initPattern.exec(content)) !== null) {
    const gridId = match[1];
    if (!grids.has(gridId)) {
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

