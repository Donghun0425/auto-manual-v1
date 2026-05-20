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

function renderOverview(data: ClxParseResult, customTitle?: string): string {
  const o = data.overview;
  if (!o.programName && !o.systemName) return "";

  const title = customTitle || "화면개요";
  const lines: string[] = [`## ${title}\n`];

  if (o.description) lines.push(`> ${o.description}\n`);

  const meta: string[] = [];
  if (o.systemName) meta.push(`**시스템:** ${o.systemName}`);
  if (o.subSystem) meta.push(`**서브시스템:** ${o.subSystem}`);
  if (o.author) meta.push(`**작성자:** ${o.author}`);
  if (o.createDate) meta.push(`**작성일:** ${o.createDate}`);
  if (meta.length > 0) lines.push(meta.join(" | ") + "\n");

  return lines.join("\n");
}

function renderUsage(data: ClxParseResult, customTitle?: string): string {
  const title = customTitle || "사용방법";

  // AI 생성 텍스트가 있으면 {B}...{/B} 파싱하여 Markdown으로 변환
  if (data.aiUsageText) {
    const lines: string[] = [`## ${title}\n`];
    for (const raw of data.aiUsageText.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^\{B\}.+\{\/B\}$/.test(line)) {
        const inner = line.replace(/^\{B\}/, "").replace(/\{\/B\}$/, "");
        lines.push(`\n**${inner}**\n`);
      } else if (/^Step\d+\./i.test(line)) {
        lines.push(`- ${line}`);
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

  if (mtb.hasInquiry) rows.push("| 조회 | 조회 버튼을 클릭하여 데이터를 검색합니다. |");
  if (mtb.hasNew) rows.push("| 신규 | 신규 버튼을 클릭하여 새 데이터를 입력합니다. |");
  if (mtb.hasSave) rows.push("| 저장 | 저장 버튼을 클릭하여 변경사항을 저장합니다. |");
  if (mtb.hasDelete) rows.push("| 삭제 | 삭제 버튼을 클릭하여 선택된 데이터를 삭제합니다. |");

  for (const btn of mtb.extButtons) {
    rows.push(`| ${btn.name} | ${btn.description || `'${btn.name}' 버튼을 클릭합니다.`} |`);
  }

  for (const tb of data.usage.titleBars) {
    const tbName = tb.title || "서브 타이틀바";
    if (tb.hasSave) rows.push(`| ${tbName} 저장 | ${tbName}의 저장 버튼을 클릭합니다. |`);
    if (tb.hasDelete) rows.push(`| ${tbName} 삭제 | ${tbName}의 삭제 버튼을 클릭합니다. |`);
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

  const title = customTitle || "조건그룹";
  const showTable = section?.options?.showTable !== false;
  const parts: string[] = [`## ${title}\n`];

  for (const group of groups) {
    const groupTitle = group.title || `${group.groupType} (${group.groupId})`;
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

  const title = customTitle || "인포그룹";
  const showTable = section?.options?.showTable !== false;
  const parts: string[] = [`## ${title}\n`];

  for (const group of groups) {
    const groupTitle = group.title || group.groupId;
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
  const grids = data.items.grids;
  if (grids.length === 0) return "";

  const title = customTitle || "그리드";
  const showTable = section?.options?.showTable !== false;
  const parts: string[] = [`## ${title}\n`];

  for (const grid of grids) {
    const gridTitle = grid.title || grid.gridId;
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

  const title = customTitle || "팝업";
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

  const title = customTitle || "탭페이지";
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
  // 조회/저장/삭제 전용은 사용방법에서 이미 표시 → 제외
  const COMPLETION_RE = /^(?:처리|저장|삭제|등록|수정|복사|생성|변경|갱신|적용|실행)[^\n]*?(?:되었습니다|했습니다|하였습니다)[.!]?\s*$/;
  const otherVals = data.notes.validations
    .filter(v => !/inq|inquiry|search|save|del/i.test(v.functionName))
    .filter(v => !COMPLETION_RE.test(v.message.trim()));

  const title = customTitle || "참고사항";
  const parts: string[] = [`## ${title}\n`];

  if (requiredFields.length > 0) {
    parts.push("### 📌 필수 입력항목\n");
    const allTexts = requiredFields.flatMap(r => r.texts);
    parts.push(allTexts.join(", ") + "\n");
  }

  if (otherVals.length > 0) {
    // 함수명 → 버튼명 맵
    const funcLabelMap = new Map<string, string>();
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

  // ── 고정 안내사항 (항상 포함) ──
  parts.push("### 🔧 시스템 오류 문의\n");
  parts.push("- 시스템 오류 또는 사용 중 문제가 발생한 경우, 정보화팀(내선: 0000)으로 문의해주세요.\n");
  parts.push("### 💾 데이터 저장 주의\n");
  parts.push("- 입력한 데이터는 '저장' 버튼을 클릭하기 전까지 저장되지 않습니다. 화면을 벗어나기 전 반드시 저장 여부를 확인하세요.\n");
  parts.push("### ⏱ 세션 만료 안내\n");
  parts.push("- 일정 시간 동안 사용하지 않으면 자동으로 로그아웃됩니다. 장시간 작업 시 중간 저장을 권장합니다.\n");

  return parts.join("\n");
}
