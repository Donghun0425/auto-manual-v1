/**
 * Markdown 매뉴얼 렌더러
 * ClxParseResult + LayoutSection[] → 구조화된 Markdown 문서 생성
 */
import type { ClxParseResult, LayoutSection } from "@/types";
import { prepareUsageSections } from "../ai/usage-section-order.ts";
import { normalizeMessage } from "../utils.ts";

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
    const orderedUsageText = prepareUsageSections(data.aiUsageText, data);
    // {MSG}~{/MSG} 다중 행 블록을 올바르게 렌더링하기 위해
    // pre-pass 정규화 대신 라인 단위 상태 머신으로 처리한다.
    // (Step 라인이 MSG 블록 안에 갇혀 msg-box로 변환되는 버그 방지)
    let inMsgBlock = false;
    const lines: string[] = [`## ${title}\n`];

    for (const raw of orderedUsageText.split("\n")) {
      const line = normalizeMessage(raw);
      if (!line) continue;

      // {B}기능명{/B} 패턴 → MSG 모드 해제
      if (/^\{B\}.+\{\/B\}$/.test(line)) {
        inMsgBlock = false;
        const inner = line.replace(/^\{B\}/, "").replace(/\{\/B\}$/, "");
        lines.push(`\n**${inner}**\n`);
        continue;
      }

      // Step\d+. 라인 → MSG 모드 해제 후 step으로 출력 (핵심: MSG 블록 안에 갇힌 Step 복구)
      if (/^Step\d+\./i.test(line)) {
        inMsgBlock = false;
        // {/MSG} 태그 제거 후 포매팅
        const clean = line.replace(/\{\/MSG\}/g, "").trim();
        if (!clean) continue;
        const formatted = clean.replace(/\{B\}([^{]+?)\{\/B\}/g, "**$1**");
        lines.push(`- ${formatted}`);
        continue;
      }

      // {MSG} 시작 (한 줄에 {MSG}~{/MSG} 모두 있는 경우는 아래에서 처리)
      if (/^\{MSG\}/.test(line) && !/\{\/MSG\}$/.test(line)) {
        inMsgBlock = true;
        const msg = line.replace(/^\{MSG\}/, "").trim();
        if (msg) lines.push(`> 💬 **"${msg}"**`);
        continue;
      }

      // {/MSG} 종료
      if (/\{\/MSG\}$/.test(line)) {
        inMsgBlock = false;
        const msg = line.replace(/\{\/MSG\}$/, "").replace(/^\{MSG\}/, "").replace(/^"|"$/g, "").trim();
        if (msg) lines.push(`> 💬 **"${msg}"**`);
        continue;
      }

      // MSG 블록 내부의 일반 텍스트
      if (inMsgBlock) {
        lines.push(`> 💬 **"${line}"**`);
        continue;
      }

      // 한 줄에 {MSG}...{/MSG}가 모두 있는 경우 (기존 동작 유지)
      if (/^\{MSG\}.+\{\/MSG\}$/.test(line)) {
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

  for (const btn of data.usage.extraButtons) {
    rows.push(`| ${btn.name} | ${btn.description || `'${btn.name}' 버튼을 클릭합니다.`} |`);
  }

  for (const tb of data.usage.titleBars) {
    const tbName = tb.title || "서브 타이틀바";
    if (tb.hasNew) rows.push(`| ${tbName} 신규 | ${tbName}에 새 행을 추가하고 필수 항목을 입력한 뒤 저장으로 이어갑니다. |`);
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
    .map((v) => ({ ...v, message: normalizeMessage(v.message) }))
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
