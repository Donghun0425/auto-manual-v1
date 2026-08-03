/**
 * 컨트롤/레이아웃 가시성 판별 유틸
 *
 * eXBuilder6의 FormLayout은 컨트롤 자체의 visible 속성 외에도
 * setRowVisible/setColumnVisible로 셀 영역을 숨길 수 있다. 숨겨진 셀에
 * 배치된 컨트롤과 컨테이너의 자손도 화면에 보이지 않으므로 메뉴얼에서
 * 제외한다.
 */

/** 정규식 특수문자 이스케이프 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ControlNode {
  id: string;
  varName: string;
  declarationIndex: number;
  parentId?: string;
  rowIndex: number;
  colIndex: number;
  rowSpan: number;
  colSpan: number;
}

interface ContainerScope {
  bodyStart: number;
  bodyEnd: number;
  parentVar: string;
}

interface AxisVisibility {
  falseIndexes: Set<number>;
  trueIndexes: Set<number>;
}

interface ContainerVisibility {
  rows: AxisVisibility;
  columns: AxisVisibility;
}

export interface LayoutVisibilityResolver {
  isVisible(controlId: string): boolean;
}

function axisVisibility(): AxisVisibility {
  return { falseIndexes: new Set(), trueIndexes: new Set() };
}

function findMatchingBrace(content: string, openBrace: number): number {
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = openBrace; i < content.length; i++) {
    const ch = content[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/** 생성 코드의 (function(container){ ... })(parentVar) 범위를 수집한다. */
function collectContainerScopes(content: string): ContainerScope[] {
  const scopes: ContainerScope[] = [];
  const marker = /\(function\s*\(container\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(content)) !== null) {
    const openBrace = content.indexOf('{', match.index);
    const bodyEnd = findMatchingBrace(content, openBrace);
    if (bodyEnd < 0) continue;
    const invocation = /^\s*\)\s*\(\s*(\w+)\s*\)\s*;?/.exec(content.slice(bodyEnd + 1));
    if (!invocation) continue;
    scopes.push({ bodyStart: openBrace + 1, bodyEnd, parentVar: invocation[1] });
    marker.lastIndex = openBrace + 1;
  }
  return scopes;
}

function innermostScope(scopes: ContainerScope[], position: number): ContainerScope | undefined {
  let found: ContainerScope | undefined;
  for (const scope of scopes) {
    if (scope.bodyStart <= position && position < scope.bodyEnd) {
      if (!found || scope.bodyStart > found.bodyStart) found = scope;
    }
  }
  return found;
}

function addAxisAssignment(axis: AxisVisibility, index: number, visible: boolean): void {
  (visible ? axis.trueIndexes : axis.falseIndexes).add(index);
}

function isStaticallyHidden(axis: AxisVisibility, index: number): boolean {
  // 한 번이라도 true로 전환되면 런타임에 노출될 수 있는 동적 영역이다.
  return axis.falseIndexes.has(index) && !axis.trueIndexes.has(index);
}

function allSpannedIndexesHidden(axis: AxisVisibility, start: number, span: number): boolean {
  for (let index = start; index < start + Math.max(1, span); index++) {
    if (!isStaticallyHidden(axis, index)) return false;
  }
  return true;
}

/**
 * 파일 하나에 대한 레이아웃 가시성 판정기를 생성한다.
 * 여러 컨트롤을 판정할 때 소스 구조를 한 번만 분석하도록 파서에서 재사용한다.
 */
export function createLayoutVisibilityResolver(content: string): LayoutVisibilityResolver {
  const scopes = collectContainerScopes(content);
  const nodesById = new Map<string, ControlNode>();
  const idByVar = new Map<string, string>();

  const declarationRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+[\w.]+\(\s*"([^"]+)"\s*\)/g;
  let declaration: RegExpExecArray | null;
  while ((declaration = declarationRe.exec(content)) !== null) {
    const node: ControlNode = {
      varName: declaration[1],
      id: declaration[2],
      declarationIndex: declaration.index,
      rowIndex: 0,
      colIndex: 0,
      rowSpan: 1,
      colSpan: 1,
    };
    nodesById.set(node.id, node);
    idByVar.set(node.varName, node.id);
  }

  for (const node of nodesById.values()) {
    const scope = innermostScope(scopes, node.declarationIndex);
    if (!scope) continue;
    node.parentId = idByVar.get(scope.parentVar);

    const afterDeclaration = content.slice(node.declarationIndex, scope.bodyEnd);
    const addChild = new RegExp(
      `container\\.addChild\\(\\s*${escapeRegex(node.varName)}\\s*,\\s*\\{([^}]+)\\}`,
    ).exec(afterDeclaration);
    if (!addChild) continue;
    const constraint = addChild[1];
    node.rowIndex = Number(/"rowIndex"\s*:\s*(\d+)/.exec(constraint)?.[1] ?? 0);
    node.colIndex = Number(/"colIndex"\s*:\s*(\d+)/.exec(constraint)?.[1] ?? 0);
    node.rowSpan = Number(/"rowSpan"\s*:\s*(\d+)/.exec(constraint)?.[1] ?? 1);
    node.colSpan = Number(/"colSpan"\s*:\s*(\d+)/.exec(constraint)?.[1] ?? 1);
  }

  const layoutOwnerByVar = new Map<string, string>();
  for (const node of nodesById.values()) {
    const setLayoutRe = new RegExp(`\\b${escapeRegex(node.varName)}\\.setLayout\\(\\s*(\\w+)\\s*\\)`, 'g');
    let setLayout: RegExpExecArray | null;
    while ((setLayout = setLayoutRe.exec(content)) !== null) {
      layoutOwnerByVar.set(setLayout[1], node.id);
    }
  }

  const visibilityByContainer = new Map<string, ContainerVisibility>();
  const forContainer = (id: string): ContainerVisibility => {
    let visibility = visibilityByContainer.get(id);
    if (!visibility) {
      visibility = { rows: axisVisibility(), columns: axisVisibility() };
      visibilityByContainer.set(id, visibility);
    }
    return visibility;
  };

  // 디자이너에서 생성된 layoutVar.setRow/ColumnVisible(...)
  const localLayoutRe = /\b(\w+)\.set(Row|Column)Visible\s*\(\s*(\d+)\s*,\s*(true|false)\s*\)/g;
  let assignment: RegExpExecArray | null;
  while ((assignment = localLayoutRe.exec(content)) !== null) {
    const ownerId = layoutOwnerByVar.get(assignment[1]);
    if (!ownerId) continue;
    const visibility = forContainer(ownerId);
    const axis = assignment[2] === 'Row' ? visibility.rows : visibility.columns;
    addAxisAssignment(axis, Number(assignment[3]), assignment[4] === 'true');
  }

  // 런타임 app.lookup("container").getLayout().setRow/ColumnVisible(...)
  const lookupLayoutRe = /app\.lookup\(\s*["']([^"']+)["']\s*\)\.getLayout\(\)\.set(Row|Column)Visible\s*\(\s*(\d+)\s*,\s*(true|false)\s*\)/g;
  while ((assignment = lookupLayoutRe.exec(content)) !== null) {
    const visibility = forContainer(assignment[1]);
    const axis = assignment[2] === 'Row' ? visibility.rows : visibility.columns;
    addAxisAssignment(axis, Number(assignment[3]), assignment[4] === 'true');
  }

  const directVisibility = (node: ControlNode): boolean => {
    const varEsc = escapeRegex(node.varName);
    const localAssignments: Array<{ position: number; visible: boolean }> = [];
    const localRe = new RegExp(`\\b${varEsc}\\.visible\\s*=\\s*(false|true)\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = localRe.exec(content)) !== null) {
      localAssignments.push({ position: match.index, visible: match[1] === 'true' });
    }
    const idEsc = escapeRegex(node.id);
    const lookupAssignments: Array<{ position: number; visible: boolean }> = [];
    const lookupRe = new RegExp(`app\\.lookup\\(\\s*["']${idEsc}["']\\s*\\)\\.visible\\s*=\\s*(false|true)\\b`, 'g');
    while ((match = lookupRe.exec(content)) !== null) {
      lookupAssignments.push({ position: match.index, visible: match[1] === 'true' });
    }
    // 기존 규칙과 동일하게 런타임 lookup 설정을 디자이너 초기값보다 우선한다.
    const assignments = lookupAssignments.length > 0 ? lookupAssignments : localAssignments;
    if (assignments.length === 0) return true;
    assignments.sort((a, b) => a.position - b.position);
    return assignments[assignments.length - 1].visible;
  };

  const memo = new Map<string, boolean>();
  const resolving = new Set<string>();
  const isVisible = (controlId: string): boolean => {
    const cached = memo.get(controlId);
    if (cached !== undefined) return cached;
    const node = nodesById.get(controlId);
    if (!node) return true;
    if (resolving.has(controlId)) return true;
    resolving.add(controlId);

    let visible = directVisibility(node);
    if (visible && node.parentId) {
      visible = isVisible(node.parentId);
      const parentLayout = visibilityByContainer.get(node.parentId);
      if (visible && parentLayout) {
        const hiddenByRows = allSpannedIndexesHidden(parentLayout.rows, node.rowIndex, node.rowSpan);
        const hiddenByColumns = allSpannedIndexesHidden(parentLayout.columns, node.colIndex, node.colSpan);
        visible = !hiddenByRows && !hiddenByColumns;
      }
    }

    resolving.delete(controlId);
    memo.set(controlId, visible);
    return visible;
  };

  return { isVisible };
}

/**
 * 기존 단일 컨트롤 API. 반복 판정은 createLayoutVisibilityResolver를 재사용한다.
 */
export function isControlVisibleInLayout(content: string, controlId: string): boolean {
  return createLayoutVisibilityResolver(content).isVisible(controlId);
}
