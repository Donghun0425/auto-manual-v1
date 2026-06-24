/**
 * HTML 매뉴얼 렌더러
 * ClxParseResult + LayoutSection[] → 독립형 HTML 문서 생성
 * v6 호환: {B}...{/B} 파싱, AI 사용방법 텍스트, 참고사항 변환
 */
import type { ClxParseResult, LayoutSection, ExtButtonInfo } from "@/types";

export function renderHtml(
  parseResult: ClxParseResult,
  sections: LayoutSection[]
): string {
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const title = parseResult.overview.programName || parseResult.filePath.split("/").pop() || "매뉴얼";
  const o = parseResult.overview;
  const metaTags = [o.systemName, o.subSystem, parseResult.filePath.split("/").pop()]
    .filter(Boolean)
    .map(t => `<span class="meta-tag">${escapeHtml(t!)}</span>`)
    .join("");
  const bodyParts: string[] = [];

  for (const section of enabledSections) {
    const html = renderSection(section, parseResult);
    if (html) bodyParts.push(html);
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - 사용자 매뉴얼</title>
<style>
${CSS_STYLES}
</style>
</head>
<body>
<div class="manual">
<div class="manual-header">
<h1>${escapeHtml(title)}</h1>
<div class="manual-meta">${metaTags}</div>
</div>
${bodyParts.join("\n")}
<div class="footer">
<p>생성일시: ${new Date().toLocaleString("ko-KR")} | CLX 매뉴얼 자동생성기</p>
</div>
</div>
</body>
</html>`;
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
  const descRow = o.description
    ? `<div class="info-row full-width"><span class="info-label">설명</span><span class="info-value" style="white-space:pre-line">${escapeHtml(o.description)}</span></div>`
    : "";
  const workflow = renderWorkflow(data);
  const flowRow = workflow
    ? `<div class="info-row full-width workflow-row"><span class="info-label">업무흐름</span><span class="info-value">${workflow}</span></div>`
    : "";

  return `<h2>${escapeHtml(title)}</h2>
<div class="section">
<div class="info-grid">
  <div class="info-row"><span class="info-label">시스템명</span><span class="info-value">${escapeHtml(o.systemName)}</span></div>
  <div class="info-row"><span class="info-label">부시스템</span><span class="info-value">${escapeHtml(o.subSystem)}</span></div>
  <div class="info-row"><span class="info-label">프로그램</span><span class="info-value">${escapeHtml(o.programName)}</span></div>
  ${descRow}
  ${flowRow}
</div>
</div>`;
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

function renderWorkflow(data: ClxParseResult): string {
  const steps = splitWorkflow(data.workHints?.flow ?? []);
  if (steps.length === 0) return "";

  const currentNames = currentScreenNames(data);
  return `<div class="workflow-pills">${steps.map((step, index) => {
    const isCurrent = isCurrentWorkflowStep(step, currentNames);
    const className = isCurrent ? "workflow-pill current" : "workflow-pill";
    const suffix = isCurrent ? '<span class="workflow-current-label">현재</span>' : "";
    return `<span class="${className}">${escapeHtml(step)}${suffix}</span>${index < steps.length - 1 ? '<span class="workflow-arrow">→</span>' : ""}`;
  }).join("")}</div>`;
}

/** 기타 버튼 설명을 <p class="step"> 배열로 반환 (다단계 지원) */
function renderBtnStepLines(btn: ExtButtonInfo): string[] {
  const desc = btn.description
    ?? (btn.name === "닫기" || /close/i.test(btn.functionName)
      ? "Step1. 현재 화면을 닫는다."
      : `Step1. '${btn.name}' 버튼을 클릭한다.`);
  return desc.split("\n").map(line => `<p class="step">${escapeHtml(line)}</p>`);
}

function renderUsage(data: ClxParseResult, customTitle?: string): string {
  const title = customTitle || "사용방법";
  const lines: string[] = [`<h2>${escapeHtml(title)}</h2>`, '<div class="section">'];

  // AI 생성 텍스트가 있으면 파싱하여 렌더링
  if (data.aiUsageText) {
    // pre-pass: 다행에 걸쳐 있는 {MSG}...{/MSG} 블록을
    //           한 행씩 {MSG}라인{/MSG} 형식으로 정규화
    const normalizedText = data.aiUsageText.replace(
      /\{MSG\}([\s\S]*?)\{\/MSG\}/g,
      (_, inner: string) =>
        inner.split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((l: string) => `{MSG}${l}{/MSG}`)
          .join('\n')
    );
    for (const raw of normalizedText.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      // {B}기능명{/B} 패턴
      if (/^\{B\}.+\{\/B\}$/.test(line)) {
        const inner = line.replace(/^\{B\}/, "").replace(/\{\/B\}$/, "");
        lines.push(`<span class="bold-tag">${escapeHtml(inner)}</span>`);
      } else if (/^Step\d+\./i.test(line)) {
        lines.push(`<p class="step">${formatInline(line)}</p>`);
      } else if (/^\{MSG\}.+\{\/MSG\}$/.test(line)) {
        const msgInner = line.replace(/^\{MSG\}/, "").replace(/\{\/MSG\}$/, "").replace(/^"|"$/g, "").trim();
        lines.push(`<p class="msg-box">💬 "${escapeHtml(msgInner)}"</p>`);
      } else if (/^[*•※⚠]|^주의|^\[주의/.test(line)) {
        lines.push(`<p class="step note-warn">${formatInline(line)}</p>`);
      } else if (/^📌|^필수/.test(line)) {
        lines.push(`<p class="step note-req">${formatInline(line)}</p>`);
      } else {
        lines.push(`<p class="step">${formatInline(line)}</p>`);
      }
    }

    // AI 텍스트에서 {B}...{/B} 소제목 집합 추출 (정밀 중복 검사용)
    const aiSectionTitles = new Set(
      [...(data.aiUsageText.matchAll(/\{B\}([^{]+?)\{\/B\}/g))].map(m => m[1].trim())
    );

    // AI 텍스트에 언급되지 않은 extraButtons만 추가 (중복 방지)
    for (const btn of data.usage.extraButtons) {
      if (aiSectionTitles.has(btn.name)) continue;
      lines.push(`<span class="bold-tag">${escapeHtml(btn.name)}</span>`);
      lines.push(...renderBtnStepLines(btn));
    }

    // PatisTitleBar 기능 추가 (AI 텍스트에 미포함된 항목만)
    // 주의: aiSectionTitles에는 "{B}타이틀바 - 버튼명{/B}" 형태로 저장되므로
    //       tbLabel 자체가 아닌 각 기능별 전체 제목으로 중복 여부를 판단해야 한다.
    for (const tb of data.usage.titleBars) {
      const tbLabel = tb.title || "상세 정보";
      // AI는 '{tbLabel} - 신규' 형식으로, fallback은 '{tbLabel} 신규' 형식으로 추가하므로
      // 양쪽 모두 체크해야 중복 방지
      if (tb.hasNew
        && !aiSectionTitles.has(`${tbLabel} 신규`)
        && !aiSectionTitles.has(`${tbLabel} - 신규`)) {
        lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - 신규</span>`);
        lines.push('<p class="step">Step1. 그리드 타이틀바의 \'신규\' 버튼을 클릭한다.</p>');
        lines.push('<p class="step">Step2. 필수 항목을 입력한다.</p>');
      }
      if (tb.hasSave
        && !aiSectionTitles.has(`${tbLabel} 저장`)
        && !aiSectionTitles.has(`${tbLabel} - 저장`)) {
        lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - 저장</span>`);
        lines.push(`<p class="step">Step1. ${escapeHtml(tbLabel)}에서 신규 입력 또는 수정된 행을 확인한다.</p>`);
        lines.push('<p class="step">Step2. 저장 전에 필수 항목과 중복 여부, 변경 상태가 올바른지 검토한다.</p>');
        lines.push(`<p class="step">Step3. '${escapeHtml(tbLabel)}' 타이틀바의 '저장' 버튼을 클릭하고, 목록에 변경 내용이 반영되었는지 확인한다.</p>`);
      }
      if (tb.hasDelete
        && !aiSectionTitles.has(`${tbLabel} 삭제`)
        && !aiSectionTitles.has(`${tbLabel} - 삭제`)) {
        lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - 삭제</span>`);
        lines.push(`<p class="step">Step1. ${escapeHtml(tbLabel)}에서 삭제할 행을 선택하고 대상 정보가 맞는지 확인한다.</p>`);
        lines.push('<p class="step">Step2. 삭제 전에 다른 업무에서 사용 중인 자료인지와 삭제 제한 조건을 확인한다.</p>');
        lines.push(`<p class="step">Step3. '${escapeHtml(tbLabel)}' 타이틀바의 '삭제' 버튼을 클릭하고, 목록에서 해당 행이 제외되었는지 확인한다.</p>`);
      }
      for (const btn of tb.extButtons) {
        // "타이틀바 - 버튼명" 형식으로 AI가 이미 생성했으면 중복 추가 금지
        if (aiSectionTitles.has(`${tbLabel} - ${btn.name}`)) continue;
        lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - ${escapeHtml(btn.name)}</span>`);
        lines.push(...renderBtnStepLines(btn));
      }
    }

    lines.push("</div>");
    return lines.join("\n");
  }

  // AI 없을 때 정적 템플릿
  const menu = data.usage.menuTitleBar;
  const shortName = getProgramShortName(data);
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

  // 함수명 기준 전처리 검증 메시지 분류
  const inqVals = data.notes.validations.filter(v => /inq|inquiry|search/i.test(v.functionName));
  const saveVals = data.notes.validations.filter(v => /save/i.test(v.functionName));
  const delVals = data.notes.validations.filter(v => /del/i.test(v.functionName));

  if (menu.hasInquiry) {
    lines.push(`<span class="bold-tag">${escapeHtml(shortName)} 조회</span>`);
    lines.push(`<p class="step">Step1. 업무에 필요한 ${escapeHtml(shortName)} 자료를 찾기 위해 ${escapeHtml(searchLabels || "조회조건")}을 확인하고 입력한다.</p>`);
    lines.push('<p class="step">Step2. 화면 상단의 \'조회\' 버튼을 클릭하여 조건에 맞는 자료를 불러온다.</p>');
    lines.push(`<p class="step">Step3. ${escapeHtml(gridNames || "결과 목록")}에서 조회된 자료가 업무 대상과 일치하는지 확인한다.</p>`);
    for (const v of inqVals) {
      lines.push(`<p class="step note-warn">⚠ ${escapeHtml(v.message)}</p>`);
    }
  }
  if (menu.hasNew) {
    lines.push(`<span class="bold-tag">${escapeHtml(shortName)} 신규</span>`);
    lines.push(`<p class="step">Step1. 새로운 ${escapeHtml(shortName)} 자료를 등록해야 할 때 화면 상단의 '신규' 버튼을 클릭한다.</p>`);
    lines.push('<p class="step">Step2. 입력 영역이 초기화되면 업무에 필요한 기본 정보와 상세 정보를 입력한다.</p>');
    lines.push('<p class="step">Step3. 저장 전에 필수 항목과 목록의 변경 상태를 확인한다.</p>');
  }
  if (menu.hasSave) {
    lines.push(`<span class="bold-tag">${escapeHtml(shortName)} 저장</span>`);
    lines.push(`<p class="step">Step1. ${escapeHtml(shortName)} 자료의 신규 입력 또는 수정 내용을 확인한다.</p>`);
    lines.push('<p class="step">Step2. 필수 항목과 중복 여부를 검토한 뒤 화면 상단의 \'저장\' 버튼을 클릭한다.</p>');
    lines.push(`<p class="step">Step3. 저장 후 ${escapeHtml(gridNames || "결과 목록")}에 변경 내용이 반영되었는지 확인한다.</p>`);
    if (data.notes.requiredFields.length > 0) {
      const allReq = data.notes.requiredFields.flatMap(f => f.texts);
      const shownReq = allReq.slice(0, 4);
      const reqDisplay = shownReq.map(escapeHtml).join(", ") +
        (allReq.length > 4 ? ` 외 ${allReq.length - 4}개` : "");
      lines.push(`<p class="step note-req">📌 필수 입력항목: ${reqDisplay}</p>`);
    }
    for (const v of saveVals) {
      lines.push(`<p class="step note-warn">⚠ ${escapeHtml(v.message)}</p>`);
    }
  }
  if (menu.hasDelete) {
    lines.push(`<span class="bold-tag">${escapeHtml(shortName)} 삭제</span>`);
    lines.push(`<p class="step">Step1. ${escapeHtml(gridNames || "목록")}에서 삭제할 자료를 선택한다.</p>`);
    lines.push('<p class="step">Step2. 삭제 전에 해당 자료가 다른 업무에서 사용 중인지와 삭제 제한 조건을 확인한다.</p>');
    lines.push('<p class="step">Step3. 화면 상단의 \'삭제\' 버튼을 클릭하여 삭제 처리를 진행하고, 목록에서 삭제 여부를 확인한다.</p>');
    for (const v of delVals) {
      lines.push(`<p class="step note-warn">⚠ ${escapeHtml(v.message)}</p>`);
    }
  }

  // 추가 버튼
  for (const btn of menu.extButtons) {
    lines.push(`<span class="bold-tag">${escapeHtml(btn.name)}</span>`);
    lines.push(...renderBtnStepLines(btn));
  }

  // PatisTitleBar 기능
  for (const tb of data.usage.titleBars) {
    const tbLabel = tb.title || "상세 정보";
    if (tb.hasNew) {
      lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - 신규</span>`);
      lines.push('<p class="step">Step1. 그리드 타이틀바의 \'신규\' 버튼을 클릭한다.</p>');
      lines.push('<p class="step">Step2. 필수 항목을 입력한다.</p>');
    }
    if (tb.hasSave) {
      lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - 저장</span>`);
      lines.push(`<p class="step">Step1. ${escapeHtml(tbLabel)}에서 신규 입력 또는 수정된 행을 확인한다.</p>`);
      lines.push('<p class="step">Step2. 저장 전에 필수 항목과 중복 여부, 변경 상태가 올바른지 검토한다.</p>');
      lines.push(`<p class="step">Step3. '${escapeHtml(tbLabel)}' 타이틀바의 '저장' 버튼을 클릭하고, 목록에 변경 내용이 반영되었는지 확인한다.</p>`);
    }
    if (tb.hasDelete) {
      lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - 삭제</span>`);
      lines.push(`<p class="step">Step1. ${escapeHtml(tbLabel)}에서 삭제할 행을 선택하고 대상 정보가 맞는지 확인한다.</p>`);
      lines.push('<p class="step">Step2. 삭제 전에 다른 업무에서 사용 중인 자료인지와 삭제 제한 조건을 확인한다.</p>');
      lines.push(`<p class="step">Step3. '${escapeHtml(tbLabel)}' 타이틀바의 '삭제' 버튼을 클릭하고, 목록에서 해당 행이 제외되었는지 확인한다.</p>`);
    }
    for (const btn of tb.extButtons) {
      lines.push(`<span class="bold-tag">${escapeHtml(tbLabel)} - ${escapeHtml(btn.name)}</span>`);
      lines.push(...renderBtnStepLines(btn));
    }
  }

  // 기타 버튼
  for (const btn of data.usage.extraButtons) {
    lines.push(`<span class="bold-tag">${escapeHtml(btn.name)}</span>`);
    lines.push(...renderBtnStepLines(btn));
  }

  lines.push("</div>");
  return lines.join("\n");
}

function renderConditions(data: ClxParseResult, customTitle?: string, section?: LayoutSection): string {
  const groups = data.items.conditionGroups;
  if (groups.length === 0) return "";

  const title = customTitle || "항목";
  const showTable = section?.options?.showTable !== false;
  const parts: string[] = [`<h2>${escapeHtml(title)}</h2>`];

  for (const group of groups) {
    const heading = group.title ?? group.groupType;
    parts.push('<div class="section">');
    parts.push(`<h3>${escapeHtml(heading)} <span class="group-id">(${escapeHtml(group.groupId)})</span></h3>`);

    if (showTable && group.controls.length > 0) {
      parts.push('<table><thead><tr>');
      parts.push('<th style="width:18%">항목명</th><th>설명</th><th style="width:15%">타입</th><th style="width:18%">용도</th>');
      parts.push('</tr></thead><tbody>');
      for (const ctrl of group.controls) {
        parts.push(`<tr>
          <td>${escapeHtml(ctrl.labelText || ctrl.controlId)}</td>
          <td>${escapeHtml(ctrl.description)}</td>
          <td><code>${escapeHtml(ctrl.controlType)}</code></td>
          <td>${escapeHtml(ctrl.inputType === "입력" ? "입력 또는 선택" : ctrl.inputType)}</td>
        </tr>`);
      }
      parts.push("</tbody></table>");
    } else {
      for (const c of group.controls) {
        parts.push(`<p class="step">• <strong>${escapeHtml(c.labelText)}</strong> (${escapeHtml(c.controlType)}) — ${escapeHtml(c.description)}</p>`);
      }
    }
    parts.push("</div>");
  }

  return parts.join("\n");
}

function renderInfoGroups(data: ClxParseResult, customTitle?: string, section?: LayoutSection): string {
  const groups = data.items.infoGroups;
  if (groups.length === 0) return "";

  const showTable = section?.options?.showTable !== false;
  // 조건그룹도 있으면 "항목" h2는 이미 출력됨
  const hasCondGroups = data.items.conditionGroups.length > 0;
  const parts: string[] = [];
  if (!hasCondGroups) {
    const title = customTitle || "항목";
    parts.push(`<h2>${escapeHtml(title)}</h2>`);
  }

  for (const group of groups) {
    const heading = group.title ?? group.groupId;
    parts.push('<div class="section">');
    parts.push(`<h3>${escapeHtml(heading)} <span class="group-id">(${escapeHtml(group.groupId)})</span></h3>`);

    if (showTable && group.controls.length > 0) {
      parts.push('<table><thead><tr>');
      parts.push('<th style="width:18%">항목명</th><th>설명</th><th style="width:15%">타입</th><th style="width:18%">용도</th>');
      parts.push('</tr></thead><tbody>');
      for (const ctrl of group.controls) {
        parts.push(`<tr>
          <td>${escapeHtml(ctrl.labelText || ctrl.controlId)}</td>
          <td>${escapeHtml(ctrl.description)}</td>
          <td><code>${escapeHtml(ctrl.controlType)}</code></td>
          <td>${escapeHtml(ctrl.inputType === "입력" ? "입력 또는 선택" : ctrl.inputType)}</td>
        </tr>`);
      }
      parts.push("</tbody></table>");
    } else {
      for (const c of group.controls) {
        parts.push(`<p class="step">• <strong>${escapeHtml(c.labelText)}</strong> (${escapeHtml(c.controlType)}) — ${escapeHtml(c.description)}</p>`);
      }
    }
    parts.push("</div>");
  }

  return parts.join("\n");
}

function renderGrids(data: ClxParseResult, customTitle?: string, section?: LayoutSection): string {
  const grids = data.items.grids.filter(g => !/EXCEL/i.test(g.gridId));
  if (grids.length === 0) return "";

  const showTable = section?.options?.showTable !== false;
  // 조건 그룹이나 INFOGROUP이 없을 때만 h2 헤더 출력
  const hasCondOrInfo = data.items.conditionGroups.length > 0 || data.items.infoGroups.length > 0;
  const parts: string[] = hasCondOrInfo ? [] : [`<h2>${escapeHtml(customTitle || "항목")}</h2>`];

  for (const grid of grids) {
    const gridTitle = grid.title || grid.gridId;
    parts.push('<div class="section">');
    parts.push(`<h3>${escapeHtml(gridTitle)} <span class="group-id">(${escapeHtml(grid.gridId)})</span></h3>`);

    // 그리드 옵션 배지
    const badges: string[] = [];
    if (grid.hasState) badges.push("상태");
    if (grid.hasCheckbox) badges.push("체크");
    if (grid.hasRowNumber) badges.push("행번호");
    if (grid.sortable) badges.push("정렬");
    if (badges.length > 0) {
      parts.push(`<p style="margin:4px 0 8px;">${badges.map(b => `<span class="badge">${b}</span>`).join(" ")}</p>`);
    }

    if (showTable && grid.columns.length > 0) {
      parts.push('<table><thead><tr>');
      parts.push('<th style="width:18%">항목명</th><th>설명</th><th style="width:15%">타입</th><th style="width:14%">용도</th>');
      parts.push('</tr></thead><tbody>');
      for (const col of grid.columns) {
        parts.push(`<tr>
          <td>${escapeHtml(col.headerText)}</td>
          <td>${escapeHtml(col.description)}</td>
          <td><code>${escapeHtml(col.controlType)}</code></td>
          <td>${escapeHtml(col.purpose)}</td>
        </tr>`);
      }
      parts.push("</tbody></table>");
    } else if (grid.columns.length > 0) {
      for (const c of grid.columns) {
        parts.push(`<p class="step">• <strong>${escapeHtml(c.headerText)}</strong> (<code>${escapeHtml(c.columnName)}</code>) — ${escapeHtml(c.description)}</p>`);
      }
    } else {
      parts.push('<p style="color:#888;">컬럼 정보 없음</p>');
    }

    parts.push("</div>");
  }

  return parts.join("\n");
}

function renderPopups(data: ClxParseResult, customTitle?: string): string {
  if (data.popups.length === 0) return "";

  const title = customTitle || "팝업";
  const rows = data.popups.map((p) =>
    `<tr><td>${escapeHtml(p.popupId)}</td><td class="popup-url">${escapeHtml(p.popupUrl)}</td><td>${p.width} × ${p.height}</td></tr>`
  ).join("\n");

  return `<h2>${escapeHtml(title)}</h2>
<div class="section">
<table><thead><tr><th>팝업 ID</th><th>URL</th><th>크기</th></tr></thead>
<tbody>${rows}</tbody></table>
</div>`;
}

function renderTabs(data: ClxParseResult, customTitle?: string): string {
  if (data.tabPages.length === 0) return "";

  const title = customTitle || "탭페이지";
  const items = data.tabPages.map((t) => {
    const display = t.tabLabel ? `${t.appUri} (${t.tabLabel})` : t.appUri;
    return `<li><span class="popup-url">${escapeHtml(display)}</span></li>`;
  }).join("\n");

  return `<h2>${escapeHtml(title)}</h2>
<div class="section"><ul>${items}</ul></div>`;
}

function renderNotes(data: ClxParseResult, customTitle?: string): string {
  const requiredFields = data.notes.requiredFields;
  const workRequired = data.workHints?.required ?? [];
  const workCaution = data.workHints?.caution ?? [];
  // 조회/저장/삭제 전용은 사용방법 섹션에서 이미 표시 → 참고사항에서 제외
  const COMPLETION_RE = /^(?:처리|저장|삭제|등록|수정|복사|생성|변경|갱신|적용|실행)[^\n]*?(?:되었습니다|했습니다|하였습니다)[.!]?\s*$/;
  const otherVals = data.notes.validations
    .filter(v => !/inq|inquiry|search|save|del/i.test(v.functionName))
    .filter(v => !COMPLETION_RE.test(v.message.trim()));

  const title = customTitle || "참고사항";
  const lines: string[] = [`<h2>${escapeHtml(title)}</h2>`, '<div class="section">'];

  // 1. 필수 입력항목
  if (requiredFields.length > 0) {
    lines.push('<span class="bold-tag">📌 필수 입력항목</span>');
    const allTexts = requiredFields.flatMap(r => r.texts);
    lines.push(`<p class="step note-req">${allTexts.map(escapeHtml).join(", ")}</p>`);
  }

  if (workRequired.length > 0) {
    lines.push('<span class="bold-tag">📌 업무 필수사항</span>');
    for (const item of workRequired) {
      lines.push(`<p class="step note-req">• ${escapeHtml(item)}</p>`);
    }
  }

  if (workCaution.length > 0) {
    lines.push('<span class="bold-tag">⚠ 업무 주의사항</span>');
    for (const item of workCaution) {
      lines.push(`<p class="step note-warn">• ${escapeHtml(item)}</p>`);
    }
  }

  // 2. 기능별 주의사항
  if (otherVals.length > 0) {
    // 함수명 → 버튼명 맵 구성
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

    // AI 변환 설명이 있으면 사용, 없으면 원본 메시지 표시
    for (const [label, messages] of groups) {
      const aiDescs = data.aiNotesDescriptions?.get(label);
      lines.push(`<span class="bold-tag">⚠ ${escapeHtml(label)}</span>`);
      messages.forEach((msg, i) => {
        const display = aiDescs?.[i] || msg;
        lines.push(`<p class="step note-warn">• ${escapeHtml(display)}</p>`);
      });
    }
  }

  // ── 고정 안내사항 ──
  lines.push('<span class="bold-tag">🔧 시스템 오류 문의</span>');
  lines.push('<p class="step note-warn">시스템 오류 또는 사용 중 문제가 발생한 경우, 정보화팀(내선: 0000)으로 문의해주세요.</p>');
  // 데이터 저장 주의: 분석 대상 파일에 저장 기능이 존재할 경우에만 표시
  if (data.usage.menuTitleBar.hasSave || data.usage.titleBars.some(tb => tb.hasSave)) {
    lines.push('<span class="bold-tag">💾 데이터 저장 주의</span>');
    lines.push('<p class="step note-warn">입력한 데이터는 \'저장\' 버튼을 클릭하기 전까지 저장되지 않습니다. 화면을 벗어나기 전 반드시 저장 여부를 확인하세요.</p>');
  }
  lines.push('<span class="bold-tag">⏱ 세션 만료 안내</span>');
  lines.push('<p class="step note-warn">일정 시간 동안 사용하지 않으면 자동으로 로그아웃됩니다. 장시간 작업 시 중간 저장을 권장합니다.</p>');

  lines.push("</div>");
  return lines.join("\n");
}

// ─── 유틸리티 ─────────────────────────────────────────────────

function getProgramShortName(data: ClxParseResult): string {
  const program = data.overview.programName;
  if (program.includes(">")) {
    return program.split(">").pop()?.trim() || program;
  }
  return program || "화면";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 단계 문장 내 인라인 강조 처리.
 * AI가 출력한 Markdown 볼드(**단어**)를 {B} 태그로 변환한 뒤 <strong>으로 렌더링한다.
 */
function formatInline(str: string): string {
  return escapeHtml(str)
    .replace(/\*\*([^*\n]+?)\*\*/g, "{B}$1{/B}")
    .replace(/\{B\}([\s\S]+?)\{\/B\}/g, "<strong>$1</strong>");
}

const CSS_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Noto Sans KR', -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif;
    max-width: 860px;
    margin: 0 auto;
    padding: 32px 20px 64px;
    line-height: 1.7;
    color: #1e293b;
    font-size: 13px;
    background: #f1f5f9;
  }
  /* 매뉴얼 카드 컨테이너 */
  .manual {
    background: #ffffff;
    border-radius: 16px;
    padding: 40px 44px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05);
  }
  /* 제목 영역 */
  .manual-header {
    padding-bottom: 24px;
    margin-bottom: 28px;
    border-bottom: 1.5px solid #e2e8f0;
  }
  h1 {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.04em;
    line-height: 1.3;
    margin-bottom: 10px;
  }
  .manual-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .meta-tag {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 500;
  }
  /* 섹션 제목 */
  h2 {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 32px;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }
  h2::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 16px;
    background: linear-gradient(180deg, #3b82f6 0%, #6366f1 100%);
    border-radius: 2px;
    flex-shrink: 0;
  }
  /* 섹션 박스 */
  .section {
    padding: 16px 20px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #ffffff;
    margin-bottom: 8px;
  }
  /* 개요 그리드 */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 24px;
  }
  .info-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 5px 0;
    border-bottom: 1px solid #f8fafc;
    font-size: 12.5px;
  }
  .info-row:last-child { border-bottom: none; }
  .info-row.full-width { grid-column: span 2; }
  .info-label {
    font-size: 10.5px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 64px;
    flex-shrink: 0;
  }
  .info-value {
    color: #1e293b;
    font-weight: 500;
  }
  .workflow-row {
    align-items: flex-start;
  }
  .workflow-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding-top: 1px;
  }
  .workflow-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 26px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #334155;
    font-size: 11.5px;
    font-weight: 650;
    line-height: 1.25;
  }
  .workflow-pill.current {
    border-color: #2563eb;
    background: #dbeafe;
    color: #1d4ed8;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
  }
  .workflow-current-label {
    display: inline-flex;
    align-items: center;
    height: 16px;
    padding: 0 6px;
    border-radius: 999px;
    background: #2563eb;
    color: #ffffff;
    font-size: 9.5px;
    font-weight: 700;
  }
  .workflow-arrow {
    color: #94a3b8;
    font-size: 13px;
    font-weight: 700;
  }
  /* 단계 설명 */
  .step {
    margin: 5px 0 5px 14px;
    color: #475569;
    font-size: 12.5px;
    line-height: 1.65;
  }
  /* 시스템 출력 메시지 박스 */
  .msg-box {
    color: #78350f;
    background: #fef9c3;
    border-left: 3px solid #f59e0b;
    padding: 5px 14px;
    margin: 4px 0 4px 14px;
    border-radius: 0 8px 8px 0;
    font-size: 12.5px;
    font-weight: 500;
  }
  /* 주의 메시지 */
  .note-warn {
    color: #92400e;
    background: #fffbeb;
    border-left: 3px solid #f59e0b;
    padding: 5px 12px;
    margin: 5px 0 5px 14px;
    border-radius: 0 8px 8px 0;
    font-size: 12.5px;
  }
  /* 필수항목 */
  .note-req {
    color: #14532d;
    background: #f0fdf4;
    border-left: 3px solid #22c55e;
    padding: 5px 12px;
    margin: 5px 0 5px 14px;
    border-radius: 0 8px 8px 0;
    font-size: 12.5px;
    font-weight: 500;
  }
  /* {B}태그 스타일 */
  .bold-tag {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 700;
    color: #0f172a;
    font-size: 12.5px;
    margin-top: 20px;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f1f5f9;
  }
  .bold-tag::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 7px;
    min-width: 7px;
    background: #3b82f6;
    border-radius: 50%;
  }
  /* 필수항목 pill */
  .required {
    display: inline-flex;
    align-items: center;
    background: #eff6ff;
    color: #1d4ed8;
    padding: 2px 10px;
    border-radius: 20px;
    margin: 2px 3px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid #bfdbfe;
  }
  /* 테이블 */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 12px;
  }
  thead tr {
    background: #f8fafc;
    border-bottom: 1.5px solid #cbd5e1;
  }
  th {
    padding: 9px 14px;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  td {
    padding: 9px 14px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: #f8fafc; }
  /* URL 모노스페이스 */
  .popup-url {
    font-family: 'Consolas', 'Menlo', monospace;
    color: #3b82f6;
    font-size: 11px;
    background: #eff6ff;
    padding: 1px 7px;
    border-radius: 5px;
    border: 1px solid #bfdbfe;
  }
  /* 그리드 소제목 */
  h3 {
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 10px;
  }
  h3 .group-id {
    font-size: 10.5px;
    color: #94a3b8;
    font-weight: 400;
    font-family: 'Consolas', 'Menlo', monospace;
    margin-left: 6px;
  }
  /* 옵션 배지 */
  .badge {
    display: inline-flex;
    align-items: center;
    background: #f1f5f9;
    color: #475569;
    padding: 2px 9px;
    border-radius: 20px;
    margin: 1px 3px;
    font-size: 10.5px;
    font-weight: 500;
    border: 1px solid #e2e8f0;
  }
  code {
    font-family: 'Consolas', 'Menlo', monospace;
    font-size: 11px;
    color: #475569;
    background: #f1f5f9;
    padding: 1px 6px;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
  }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin-bottom: 5px; font-size: 12.5px; color: #475569; }
  /* 화면 이미지 */
  .screen-image { margin-bottom: 24px; text-align: center; }
  .screen-image img {
    max-width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
    letter-spacing: 0.01em;
  }
`;
