/**
 * Markdown 매뉴얼 렌더러
 * ClxParseResult + LayoutSection[] → 구조화된 Markdown 문서 생성
 */
import type { ClxParseResult, LayoutSection } from "@/types";

export function renderMarkdown(
  parseResult: ClxParseResult,
  sections: LayoutSection[]
): string {
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const title = parseResult.overview.programName || parseResult.filePath.split("/").pop() || "매뉴얼";
  const parts: string[] = [`# ${title}\n`];

  for (const section of enabledSections) {
    const md = renderSection(section, parseResult);
    if (md) parts.push(md);
  }

  parts.push(`\n---\n\n*생성일시: ${new Date().toLocaleString("ko-KR")} | CLX 매뉴얼 자동생성기*\n`);

  return parts.join("\n");
}

function renderSection(section: LayoutSection, data: ClxParseResult): string {
  const customTitle = section.options?.customTitle;

  switch (section.id) {
    case "overview":
      return renderOverview(data, customTitle);
    case "usage":
      return renderUsage(data, customTitle);
    case "conditions":
      return renderConditions(data, customTitle, section);
    case "info":
      return renderInfoGroups(data, customTitle, section);
    case "grid":
      return renderGrids(data, customTitle, section);
    case "popup":
      return renderPopups(data, customTitle);
    case "tabs":
      return renderTabs(data, customTitle);
    case "notes":
      return renderNotes(data, customTitle);
    default:
      return "";
  }
}

// ─── 개별 섹션 렌더러 ──────────────────────────────────────────

// ─── 제목 접두어 헬퍼 ────────────────────────────────────

/** app.title 우선, 없으면 programName */
function programNameOf(data: ClxParseResult): string {
  return (data.overview.appTitle || data.overview.programName || "").trim();
}

/** 섹션 제목 접두어: "[프로그램명] " 또는 "" */
function sectionPrefix(data: ClxParseResult): string {
  const pn = programNameOf(data);
  return pn ? `[${pn}] ` : "";
}

/** 항목 h3 제목 접두어: "[프로그램명 > 그룹라벨] " 또는 "[그룹라벨] " */
function groupPrefix(data: ClxParseResult, groupLabel: string): string {
  const pn = programNameOf(data);
  return pn ? `[${pn} > ${groupLabel}] ` : `[${groupLabel}] `;
}

/** 조건그룹 groupType → 항목 그룹라벨 */
function conditionGroupLabel(groupType: string): string {
  switch (groupType) {
    case "조회조건":
      return "조건그룹";
    case "처리조건":
      return "처리그룹";
    case "일괄처리":
      return "배치그룹";
    default:
      return groupType;
  }
}

function splitWorkflow(flowLines: string[]): string[] {
  return flowLines
    .flatMap((line) => line.split(/\s*(?:->|→|➜|⇒)\s*/))
    .map((step) => step.trim())
    .filter(Boolean);
}

function normalizeStep(value: string): string {
  return value.replace(/\s+/g, "").replace(/[()[\]{}<>]/g, "").toLowerCase();
}

function currentScreenNames(data: ClxParseResult): string[] {
  const names = [
    data.overview.appTitle,
    data.overview.programName,
    data.overview.programName.split(">").pop(),
    data.filePath.split(/[\\/]/).pop()?.replace(/\.clx\.js$/i, ""),
  ];
  return names.filter((name): name is string => !!name && !!name.trim()).map(normalizeStep);
}

function isCurrentWorkflowStep(step: string, currentNames: string[]): boolean {
  const normalizedStep = normalizeStep(step);
  return currentNames.some((name) =>
    normalizedStep === name ||
    (name.length >= 3 && normalizedStep.includes(name)) ||
    (normalizedStep.length >= 3 && name.includes(normalizedStep))
  );
}

function renderWorkflowText(data: ClxParseResult): string {
  const steps = splitWorkflow(data.workHints?.flow ?? []);
  if (steps.length === 0) return "";

  const names = currentScreenNames(data);
  return steps
    .map((step) => isCurrentWorkflowStep(step, names) ? `**${step} (현재 화면)**` : step)
    .join(" → ");
}

function renderOverview(data: ClxParseResult, customTitle?: string): string {
  const o = data.overview;
  if (!o.programName && !o.systemName) return "";

  const title = sectionPrefix(data) + (customTitle || "화면개요");
  const lines: string[] = [`## ${title}\n`];

  if (o.description) lines.push(`> ${o.description.split("\n").join("\n> ")}\n`);
  const workflow = renderWorkflowText(data);
  if (workflow) {
    lines.push(`**업무흐름:** ${workflow}\n`);
  }

  const meta: string[] = [];
  if (o.systemName) meta.push(`**시스템:** ${o.systemName}`);
  if (o.subSystem) meta.push(`**서브시스템:** ${o.subSystem}`);
  if (meta.length > 0) lines.push(meta.join(" | ") + "\n");

  return lines.join("\n");
}

function renderUsage(data: ClxParseResult, customTitle?: string): string {
  const title = sectionPrefix(data) + (customTitle || "사용방법");

  // AI 생성 텍스트가 있으면 {B}...{/B} 파싱하여 Markdown으로 변환
  if (data.aiUsageText) {
    // pre-pass: 다행(또는 리터럴 \n)에 걸쳐 있는 {MSG}...{/MSG} 블록을
    //           한 행씩 {MSG}라인{/MSG} 형식으로 정규화
    const normalizedText = data.aiUsageText.replace(
      /\{MSG\}([\s\S]*?)\{\/MSG\}/g,
      (_, inner: string) =>
        inner.split(/\\n|\n/)
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((l: string) => `{MSG}${l}{/MSG}`)
          .join('\n')
    );
    const lines: string[] = [`## ${title}\n`];
    for (const raw of normalizedText.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^\{B\}.+\{\/B\}$/.test(line)) {
        const inner = line.replace(/^\{B\}/, "").replace(/\{\/B\}$/, "");
        lines.push(`\n**${inner}**\n`);
      } else if (/^Step\d+\./i.test(line)) {
        // 인라인 {B}...{/B} 태그를 **...** 로 변환
        const formatted = line.replace(/\{B\}([^{]+?)\{\/B\}/g, "**$1**");
        lines.push(`- ${formatted}`);
      } else if (/^\{MSG\}.+\{\/MSG\}$/.test(line)) {
        const msgInner = line.replace(/^\{MSG\}/, "").replace(/\{\/MSG\}$/, "").replace(/^"|"$/g, "").trim();
        lines.push(`> 💬 **"${msgInner}"**`);
      } else if (/^[*•※⚠]|^주의|^\[주의/.test(line)) {
        lines.push(`> ⚠️ ${line}`);
      } else if (/^📌|^필수/.test(line)) {
        lines.push(`> ${line}`);
      } else {
        lines.push(`- ${line}`);
      }
    }
    // AI 텍스트에서 {B}...{/B} 소제목 집합 추출 (중복 방지)
    const aiSectionTitles = new Set(
      [...(data.aiUsageText.matchAll(/\{B\}([^{]+?)\{\/B\}/g))].map(m => m[1].trim())
    );

    // AI 텍스트에 미포함된 extraButtons 추가
    for (const btn of data.usage.extraButtons) {
      if (aiSectionTitles.has(btn.name)) continue;
      lines.push(`\n**${btn.name}**\n`);
      const desc = btn.description
        ?? (btn.name === "닫기" || /close/i.test(btn.functionName)
          ? "Step1. 현재 화면을 닫는다."
          : `Step1. '${btn.name}' 버튼을 클릭한다.`);
      for (const step of desc.split("\n")) {
        if (step.trim()) lines.push(`- ${step.trim()}`);
      }
    }

    lines.push("");
    return lines.join("\n");
  }

  // AI 없을 때 기본 테이블 형식
  const mtb = data.usage.menuTitleBar;
  const rows: string[] = [];
  const searchLabels = data.items.conditionGroups
    .filter((g) => g.groupType === "조회조건")
    .flatMap((g) => g.controls.map((c) => c.labelText))
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");
  const gridNames = data.items.grids
    .filter((g) => g.title)
    .map((g) => g.title)
    .slice(0, 3)
    .join(", ");

  if (mtb.hasInquiry) rows.push(`| 조회 | ${searchLabels || "조회조건"}을 기준으로 업무 대상을 검색하고, ${gridNames || "결과 목록"}에서 필요한 자료를 확인합니다. |`);
  if (mtb.hasNew) rows.push("| 신규 | 새 업무 자료를 등록해야 할 때 입력 영역을 초기화하고, 필수 정보 입력 후 저장으로 이어갑니다. |");
  if (mtb.hasSave) rows.push(`| 저장 | 신규/수정된 내용을 필수값과 중복 조건 기준으로 확인한 뒤 저장하고, ${gridNames || "결과 목록"}에 반영되었는지 확인합니다. |`);
  if (mtb.hasDelete) rows.push(`| 삭제 | ${gridNames || "목록"}에서 삭제 대상을 선택하고, 삭제 제한 조건을 확인한 뒤 처리 결과를 확인합니다. |`);

  for (const btn of mtb.extButtons) {
    rows.push(`| ${btn.name} | ${btn.description || `'${btn.name}' 버튼을 클릭합니다.`} |`);
  }

  for (const tb of data.usage.titleBars) {
    const tbName = tb.title || "서브 타이틀바";
    if (tb.hasSave) rows.push(`| ${tbName} 저장 | ${tbName}에서 신규/수정된 행의 필수값과 중복 여부를 확인한 뒤 저장하고, 목록에 변경 내용이 반영되었는지 확인합니다. |`);
    if (tb.hasDelete) rows.push(`| ${tbName} 삭제 | ${tbName}에서 삭제할 행을 선택하고 삭제 제한 조건을 확인한 뒤 처리하며, 목록에서 해당 행이 제외되었는지 확인합니다. |`);
    for (const btn of tb.extButtons) {
      rows.push(`| ${tbName} ${btn.name} | ${btn.description || `'${btn.name}' 버튼을 클릭합니다.`} |`);
    }
  }

  if (rows.length === 0) return "";

  return `## ${title}\n\n| 기능 | 설명 |\n|------|------|\n${rows.join("\n")}\n`;
}

function renderConditions(data: ClxParseResult, customTitle?: string, section?: LayoutSection): string {
  const groups = data.items.conditionGroups;
  if (groups.length === 0) return "";

  const title = sectionPrefix(data) + (customTitle || "항목");
  const showTable = section?.options?.showTable !== false;
  const parts: string[] = [`## ${title}\n`];

  for (const group of groups) {
    const groupTitle = `${groupPrefix(data, conditionGroupLabel(group.groupType))}${group.title || group.groupType} (${group.groupId})`;
    parts.push(`### ${groupTitle}\n`);

    if (showTable) {
      parts.push("| 항목명 | 컨트롤 | 구분 | 설명 |");
      parts.push("|--------|--------|------|------|");
      for (const c of group.controls) {
        parts.push(`| ${c.labelText} | ${c.controlType} | ${c.inputType} | ${c.description} |`);
      }
    } else {
      for (const c of group.controls) {
        parts.push(`- **${c.labelText}** (${c.controlType}) — ${c.description}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

function renderInfoGroups(data: ClxParseResult, customTitle?: string, section?: LayoutSection): string {
  const groups = data.items.infoGroups;
  if (groups.length === 0) return "";

  const showTable = section?.options?.showTable !== false;
  // 조건그룹이 있으면 "항목" h2는 이미 출력됨
  const hasCondGroups = data.items.conditionGroups.length > 0;
  const parts: string[] = [];
  if (!hasCondGroups) {
    const title = sectionPrefix(data) + (customTitle || "항목");
    parts.push(`## ${title}\n`);
  }

  for (const group of groups) {
    const groupTitle = `${groupPrefix(data, "인포그룹")}${group.title || group.groupId} (${group.groupId})`;
    parts.push(`### ${groupTitle}\n`);

    if (showTable) {
      parts.push("| 항목명 | 컨트롤 | 구분 | 설명 |");
      parts.push("|--------|--------|------|------|");
      for (const c of group.controls) {
        parts.push(`| ${c.labelText} | ${c.controlType} | ${c.inputType} | ${c.description} |`);
      }
    } else {
      for (const c of group.controls) {
        parts.push(`- **${c.labelText}** (${c.controlType}) — ${c.description}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

function renderGrids(data: ClxParseResult, customTitle?: string, section?: LayoutSection): string {
  const grids = data.items.grids.filter(g => !/EXCEL/i.test(g.gridId));
  if (grids.length === 0) return "";

  const showTable = section?.options?.showTable !== false;
  // 조건그룹이나 INFOGROUP이 없을 때만 "항목" h2 출력
  const hasCondOrInfo = data.items.conditionGroups.length > 0 || data.items.infoGroups.length > 0;
  const parts: string[] = hasCondOrInfo ? [] : [`## ${sectionPrefix(data) + (customTitle || "항목")}\n`];

  for (const grid of grids) {
    const gridTitle = `${groupPrefix(data, "그리드그룹")}${grid.title || grid.gridId} (${grid.gridId})`;
    const options: string[] = [];
    if (grid.hasCheckbox) options.push("체크박스");
    if (grid.hasRowNumber) options.push("행번호");
    if (grid.sortable) options.push("정렬");
    if (grid.hasState) options.push("상태표시");

    parts.push(`### ${gridTitle}\n`);
    if (options.length > 0) parts.push(`> 옵션: ${options.join(", ")}\n`);

    if (showTable) {
      parts.push("| 헤더 | 컬럼ID | 컨트롤 | 용도 | 설명 |");
      parts.push("|------|--------|--------|------|------|");
      for (const c of grid.columns) {
        parts.push(`| ${c.headerText} | \`${c.columnName}\` | ${c.controlType} | ${c.purpose} | ${c.description} |`);
      }
    } else {
      for (const c of grid.columns) {
        parts.push(`- **${c.headerText}** (\`${c.columnName}\`) — ${c.description}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

function renderPopups(data: ClxParseResult, customTitle?: string): string {
  if (data.popups.length === 0) return "";

  const title = sectionPrefix(data) + (customTitle || "팝업");
  const parts: string[] = [`## ${title}\n`];
  parts.push("| 팝업 ID | URL | 콜백 함수 | 크기 |");
  parts.push("|---------|-----|-----------|------|");
  for (const p of data.popups) {
    parts.push(`| ${p.popupId} | \`${p.popupUrl}\` | ${p.callbackFunction} | ${p.width}×${p.height} |`);
  }
  parts.push("");

  return parts.join("\n");
}

function renderTabs(data: ClxParseResult, customTitle?: string): string {
  if (data.tabPages.length === 0) return "";

  const title = sectionPrefix(data) + (customTitle || "탭페이지");
  const parts: string[] = [`## ${title}\n`];
  parts.push("| 탭 라벨 | 앱 URI | 호출 위치 |");
  parts.push("|---------|--------|-----------|");
  for (const t of data.tabPages) {
    parts.push(`| ${t.tabLabel || "-"} | \`${t.appUri}\` | ${t.calledFrom} |`);
  }
  parts.push("");

  return parts.join("\n");
}

function renderNotes(data: ClxParseResult, customTitle?: string): string {
  const requiredFields = data.notes.requiredFields;
  const workRequired = data.workHints?.required ?? [];
  const workCaution = data.workHints?.caution ?? [];
  // 조회/저장/삭제 전용은 사용방법에서 이미 표시 → 제외
  const COMPLETION_RE = /^(?:처리|저장|삭제|등록|수정|복사|생성|변경|갱신|적용|실행)[^\n]*?(?:되었습니다|했습니다|하였습니다)[.!]?\s*$/;
  const otherVals = data.notes.validations
    .filter(v => !/inq|inquiry|search|save|del/i.test(v.functionName))
    .filter(v => !COMPLETION_RE.test(v.message.trim()));

  const title = sectionPrefix(data) + (customTitle || "참고사항");
  const parts: string[] = [`## ${title}\n`];

  if (requiredFields.length > 0) {
    parts.push("### 📌 필수 입력항목\n");
    const allTexts = requiredFields.flatMap(r => r.texts);
    parts.push(allTexts.join(", ") + "\n");
  }

  if (workRequired.length > 0) {
    parts.push("### 📌 업무 필수사항\n");
    for (const item of workRequired) {
      parts.push(`- ${item}`);
    }
    parts.push("");
  }

  if (workCaution.length > 0) {
    parts.push("### ⚠ 업무 주의사항\n");
    for (const item of workCaution) {
      parts.push(`- ${item}`);
    }
    parts.push("");
  }

  if (otherVals.length > 0) {
    // 함수명 → 버튼명 맵
    const funcLabelMap = new Map<string, string>();
    for (const btn of data.usage.menuTitleBar.extButtons) {
      funcLabelMap.set(btn.functionName, btn.name);
    }
    for (const btn of data.usage.extraButtons) {
      funcLabelMap.set(btn.functionName, btn.name);
    }
    for (const tb of data.usage.titleBars) {
      const tbLabel = tb.title || "상세 정보";
      for (const btn of tb.extButtons) {
        funcLabelMap.set(btn.functionName, `${tbLabel} - ${btn.name}`);
      }
    }

    // 그룹화
    const groups = new Map<string, string[]>();
    for (const v of otherVals) {
      const btnLabel = funcLabelMap.get(v.functionName);
      const label = btnLabel ? `${btnLabel} 실행 전 확인사항` : "기타 주의사항";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(v.message);
    }

    for (const [label, messages] of groups) {
      const aiDescs = data.aiNotesDescriptions?.get(label);
      parts.push(`### ⚠ ${label}\n`);
      messages.forEach((msg, i) => {
        const display = aiDescs?.[i] || msg;
        parts.push(`- ${display}`);
      });
      parts.push("");
    }
  }

  // ── 고정 안내사항 ──
  parts.push("### 🔧 시스템 오류 문의\n");
  parts.push("- 시스템 오류 또는 사용 중 문제가 발생한 경우, 정보화팀(내선: 0000)으로 문의해주세요.\n");
  // 데이터 저장 주의: 분석 대상 파일에 저장 기능이 존재할 경우에만 표시
  if (data.usage.menuTitleBar.hasSave || data.usage.titleBars.some(tb => tb.hasSave)) {
    parts.push("### 💾 데이터 저장 주의\n");
    parts.push("- 입력한 데이터는 '저장' 버튼을 클릭하기 전까지 저장되지 않습니다. 화면을 벗어나기 전 반드시 저장 여부를 확인하세요.\n");
  }
  parts.push("### ⏱ 세션 만료 안내\n");
  parts.push("- 일정 시간 동안 사용하지 않으면 자동으로 로그아웃됩니다. 장시간 작업 시 중간 저장을 권장합니다.\n");

  return parts.join("\n");
}
