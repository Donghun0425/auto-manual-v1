/**
 * 프롬프트 엔지니어링 모듈
 * CLX 파싱 결과를 바탕으로 AI에 전달할 프롬프트를 구성
 */
import type { AiMessage, ClxParseResult, GridColumnInfo, ConditionControlInfo, CrudInfo, ExtButtonInfo } from "@/types";
import { getUsageSectionTitles } from "./usage-section-order.ts";

/** 시스템 프롬프트 (공통) */
const SYSTEM_PROMPT = `당신은 IT 비전문가(학생, 일반 학부모, 교직원 등)가 복잡한 시스템 용어를 쉽게 이해할 수 있도록 돕는 전문 UX 라이터이자 데이터 해설가입니다.
대학 행정 시스템(CLX)의 화면 항목명을 보고, 실제 화면에서 어떤 의미로 쓰이는지 사용자 친화적인 언어로 설명합니다.

작성 규칙:
- 대상 독자: 개발이나 DB 지식이 전혀 없는 일반인입니다.
- 금지 용어: "DB 컬럼", "플래그(Flag)", "불리언(Boolean)", "코드값", "엔티티", "테이블", "스키마", "null", "쿼리" 등 IT 전문 용어는 절대 사용하지 마세요.
- 길이 제한: 각 항목당 2줄 이내로 핵심만 작성하세요.
- 구체성: '누구를 위한 것인지', '어떤 목적으로 쓰이는지'가 명확하게 드러나야 합니다.
- "~합니다" 체 사용`;

function hasWorkHints(parseResult: ClxParseResult): boolean {
  const hints = parseResult.workHints;
  return !!hints && (
    hints.flow.length > 0 ||
    hints.required.length > 0 ||
    hints.caution.length > 0
  );
}

function formatWorkHints(parseResult: ClxParseResult): string {
  const hints = parseResult.workHints;
  if (!hints) return "";

  const parts: string[] = [];
  if (hints.flow.length > 0) {
    parts.push(`[업무흐름]\n${hints.flow.map((v) => `- ${v}`).join("\n")}`);
  }
  if (hints.required.length > 0) {
    parts.push(`[필수사항]\n${hints.required.map((v) => `- ${v}`).join("\n")}`);
  }
  if (hints.caution.length > 0) {
    parts.push(`[주의사항]\n${hints.caution.map((v) => `- ${v}`).join("\n")}`);
  }
  return parts.join("\n");
}

/**
 * 그리드 컬럼 설명 생성 프롬프트
 */
export function buildGridColumnPrompt(
  parseResult: ClxParseResult,
  grid: { gridId: string; title: string },
  columns: GridColumnInfo[],
  udcHint = ""
): AiMessage[] {
  const screenContext = `화면명: ${parseResult.overview.programName}, 시스템: ${parseResult.overview.systemName}${udcHint}`;
  const columnList = columns
    .map((c) => `- ${c.headerText} (타입: ${c.controlType})`)
    .join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${screenContext}
그리드 "${grid.title}"의 다음 항목들이 실제 화면에서 어떤 정보를 보여주는지 일반 사용자 눈높이로 설명해주세요.

항목 목록:
${columnList}

주의사항:
- DB나 개발 용어 없이, 이 항목이 사용자에게 '어떤 정보'를 보여주는지 설명하세요.
- 예시: "학생의 이름을 표시합니다." / "해당 학기에 신청한 강좌명을 나타냅니다."
- 반드시 2줄 이내로 작성하세요.

정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:
[{"columnName": "항목명", "description": "설명"}]

"columnName"에는 위 항목 목록의 항목명을 그대로 사용하세요.`,
    },
  ];
}

/**
 * 조건그룹 컨트롤 설명 생성 프롬프트
 * v6 방식: 그룹타입별로 다른 프롬프트 적용 (조회조건/처리조건/세부정보)
 */
export function buildConditionControlPrompt(
  parseResult: ClxParseResult,
  groupType: string,
  controls: ConditionControlInfo[],
  udcHint = ""
): AiMessage[] {
  const screenContext = `화면명: ${parseResult.overview.programName}, 시스템: ${parseResult.overview.systemName}${udcHint}`;
  const controlList = controls
    .map((c, i) => {
      const base = `${i + 1}. ${c.labelText} (ID: ${c.controlId}, 타입: ${c.controlType}, ${c.inputType})`;
      return c.logicHint ? `${base}\n   └ 동작: ${c.logicHint}` : base;
    })
    .join("\n");

  let systemPrompt: string;
  let userPrompt: string;

  if (groupType === "처리조건" || groupType === "일괄처리") {
    // 처리조건: 어떤 값을 선택/입력하면 어떤 처리가 이루어지는지
    const menu = parseResult.usage.menuTitleBar;
    const txFeatures: string[] = [];
    if (menu.hasSave) txFeatures.push("저장");
    if (menu.hasDelete) txFeatures.push("삭제");
    if (menu.hasNew) txFeatures.push("신규");
    const txList = txFeatures.length > 0 ? txFeatures.join(", ") : "처리";

    systemPrompt = SYSTEM_PROMPT;
    userPrompt =
      `${screenContext}\n"${groupType}" 항목들이 처리 화면에서 어떤 역할을 하는지 일반 사용자 눈높이로 설명해주세요.\n\n항목 목록:\n${controlList}\n\n` +
      `주의사항:\n` +
      `- 이 항목에 어떤 값을 입력하거나 선택하면 어떤 처리(${txList})에 영향을 주는지 설명하세요.\n` +
      `- DB나 개발 용어 없이, 사용자가 '왜 이 항목에 값을 입력하는지' 이해할 수 있게 작성하세요.\n` +
      `- 예시: "일괄 처리할 대상의 구분을 선택합니다. 선택한 값에 따라 저장 대상이 달라집니다."\n` +
      `- 반드시 2줄 이내로 작성하세요.\n\n` +
      `정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:\n` +
      `[{"controlId": "항목ID", "description": "설명"}]`;
  } else if (groupType === "세부정보") {
    // 인포영역(세부정보): 선택한 행의 어떤 상세 정보를 표시/입력하는지
    systemPrompt = SYSTEM_PROMPT;
    userPrompt =
      `${screenContext}\n"${groupType}" 항목들이 상세 정보 영역에서 어떤 내용을 보여주거나 입력받는지 일반 사용자 눈높이로 설명해주세요.\n\n항목 목록:\n${controlList}\n\n` +
      `주의사항:\n` +
      `- 이 항목이 '어떤 사람의 어떤 정보'를 표시하거나 입력받는지 설명하세요.\n` +
      `- DB나 개발 용어 없이 작성하세요.\n` +
      `- 예시: "선택한 학생의 학과명을 표시합니다." / "담당자의 연락처를 입력하는 항목입니다."\n` +
      `- 반드시 2줄 이내로 작성하세요.\n\n` +
      `정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:\n` +
      `[{"controlId": "항목ID", "description": "설명"}]`;
  } else {
    // 조회조건: 어떤 조건으로 목록을 검색하는지
    systemPrompt = SYSTEM_PROMPT;
    userPrompt =
      `${screenContext}\n"${groupType}" 항목들이 목록 조회 시 어떤 검색 조건으로 쓰이는지 일반 사용자 눈높이로 설명해주세요.\n\n항목 목록:\n${controlList}\n\n` +
      `주의사항:\n` +
      `- 이 항목에 어떤 값을 넣으면 어떤 결과를 좁혀서 볼 수 있는지 설명하세요.\n` +
      `- DB나 개발 용어 없이 작성하세요.\n` +
      `- 항목에 '동작:' 정보가 있으면 그 내용을 반영하여 설명하세요. 체크박스의 전환 동작이나 선택지(라디오/콤보)의 각 선택값이 어떤 의미인지 사용자 눈높이로 풀어주세요.\n` +
      `- 예시: "조회할 학년도를 선택합니다. 선택한 연도의 데이터만 표시됩니다." / "이름의 일부를 입력하여 학생을 검색합니다."\n` +
      `- 반드시 2줄 이내로 작성하세요.\n\n` +
      `정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:\n` +
      `[{"controlId": "항목ID", "description": "설명"}]`;
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

/**
 * 버튼 설명 생성 프롬프트
 */
export function buildButtonDescriptionPrompt(
  parseResult: ClxParseResult,
  buttons: { name: string; functionName: string }[]
): AiMessage[] {
  const screenContext = `화면명: ${parseResult.overview.programName}, 시스템: ${parseResult.overview.systemName}`;
  const buttonList = buttons
    .map((b) => `- "${b.name}" (함수: ${b.functionName})`)
    .join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${screenContext}
다음 버튼들에 대해 사용자가 이해할 수 있는 동작 설명을 작성해주세요.

버튼 목록:
${buttonList}

각 버튼에 대해 정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:
name은 버튼 목록의 버튼명을 축약하거나 변경하지 말고 그대로 복사하세요.
[{"name": "버튼명", "description": "Step1. '버튼명' 버튼을 클릭하여 ~합니다. (40자 이내)"}]`,
    },
  ];
}

/**
 * 화면 개요 설명 생성 프롬프트
 */
export function buildOverviewPrompt(parseResult: ClxParseResult): AiMessage[] {
  const hasCrud = parseResult.usage.menuTitleBar;
  const features: string[] = [];
  if (hasCrud.hasInquiry) features.push("조회");
  if (hasCrud.hasNew) features.push("신규등록");
  if (hasCrud.hasSave) features.push("저장");
  if (hasCrud.hasDelete) features.push("삭제");

  const gridCount = parseResult.items.grids.length;
  const condCount = parseResult.items.conditionGroups.length;
  const workHintContext = hasWorkHints(parseResult)
    ? `\n작성자가 제공한 업무 힌트:\n${formatWorkHints(parseResult)}\n`
    : "";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `다음 정보를 바탕으로 이 화면이 무엇을 하는 화면인지 비개발자(학생, 교직원, 일반 사용자)가 바로 이해할 수 있도록 자세하게 설명해주세요.

- 화면명: ${parseResult.overview.programName}
- 시스템: ${parseResult.overview.systemName} > ${parseResult.overview.subSystem}
- CRUD 기능: ${features.join(", ") || "없음"}
- 그리드 수: ${gridCount}개
- 조건그룹 수: ${condCount}개
- 탭 페이지: ${parseResult.tabPages.length}개
${workHintContext}

작성 규칙:
- 이 화면의 목적, 주요 기능, 사용 대상을 포함하여 설명하세요.
- 작성자가 제공한 업무 힌트가 있으면 이 화면이 전체 업무 흐름에서 어느 단계인지 자연스럽게 반영하세요.
- 3줄 이내로 작성하되, 각 줄은 줄바꿈(\n)으로 구분하세요.
- 개발 용어(DB, 컬럼, 플래그 등) 없이 일반 사용자 눈높이로 작성하세요.
- 설명 텍스트만 출력하세요. 다른 텍스트는 포함하지 마세요.`,
    },
  ];
}

/**
 * CRUD 작업별 비즈니스 로직을 프롬프트 컨텍스트 블록으로 변환한다.
 * operations[]의 사전조건/처리/검증/필수입력값/중복불가를 작업 단위로 정리한다.
 * @param crud  CRUD 정보 (operations 포함)
 * @param scope 범위 라벨 (예: "상단 메뉴 타이틀바", "그리드 타이틀바 - 상세정보")
 */
function buildCrudLogicContext(crud: CrudInfo, scope: string): string | null {
  if (!crud.operations || crud.operations.length === 0) return null;

  const blocks: string[] = [];
  for (const op of crud.operations) {
    const lines: string[] = [`■ ${op.operation}`];

    // 필수 입력값 / 중복 불가 (저장 전용)
    if (op.requiredFields && op.requiredFields.length > 0) {
      lines.push(`  · 필수 입력값: ${op.requiredFields.join(", ")}`);
    }
    if (op.uniqueKeys && op.uniqueKeys.length > 0) {
      lines.push(`  · 중복 불가: ${op.uniqueKeys.join(" + ")} 조합은 중복될 수 없습니다.`);
    }

    // 사전조건/가드 — {MSG} 형식
    for (const pre of op.preconditions) {
      lines.push(`  · 사전조건: {MSG}${pre}{/MSG}`);
    }

    // 처리 단계 (시그널 기반 설명)
    for (const note of op.processNotes) {
      lines.push(`  · 처리: ${note}`);
    }

    // 추가 검증 (사전조건에 없는 Action 단계 검증) — {MSG} 형식
    const extraValidations = op.validations.filter((v) => !op.preconditions.includes(v));
    for (const v of extraValidations) {
      lines.push(`  · 검증: {MSG}${v}{/MSG}`);
    }

    blocks.push(lines.join("\n"));
  }

  return `CRUD 비즈니스 로직(${scope}):\n${blocks.join("\n")}`;
}

/**
 * 추가 버튼(ext) 정적 분석 비즈니스 로직을 들여쓰기 블록으로 변환한다.
 * 사전조건/검증은 {MSG} 형식, 확인(confirm)·처리(시그널)는 일반 서술로 정리한다.
 * @returns 들여쓰기된 멀티라인 블록(각 줄 4칸 들여쓰기), logic이 없으면 null
 */
function buildExtButtonLogicContext(btn: ExtButtonInfo): string | null {
  const logic = btn.logic;
  if (!logic) return null;

  const lines: string[] = [];
  for (const g of logic.guards) lines.push(`· 사전조건: {MSG}${g}{/MSG}`);
  for (const v of logic.validations) lines.push(`· 검증: {MSG}${v}{/MSG}`);
  for (const c of logic.confirmMessages) lines.push(`· 확인: {MSG}${c}{/MSG}`);
  for (const n of logic.processNotes) lines.push(`· 처리: ${n}`);

  if (lines.length === 0) return null;
  return lines.map((l) => "    " + l).join("\n");
}

/**
 * 사용방법 Step별 설명 생성 프롬프트 (v6 호환)
 * {B}기능명{/B} + Step1~N 형식
 */
export function buildUsagePrompt(parseResult: ClxParseResult, udcHint = ""): AiMessage[] {
  const menu = parseResult.usage.menuTitleBar;

  // 기능 목록 (MenuTitleBar CRUD + 추가 버튼 + 독립 버튼)
  const features: string[] = [];
  if (menu.hasInquiry) features.push("조회");
  if (menu.hasNew) features.push("신규");
  if (menu.hasSave) features.push("저장");
  if (menu.hasDelete) features.push("삭제");
  for (const btn of menu.extButtons) features.push(btn.name);
  for (const btn of parseResult.usage.extraButtons) features.push(btn.name);

  // PatisTitleBar 기능 목록
  const titleBarFeatureLines = parseResult.usage.titleBars.flatMap((tb) => {
    const label = tb.title || "상세 정보";
    const feats: string[] = [];
    if (tb.hasNew) feats.push(`  - ${label} - 신규`);
    if (tb.hasSave) feats.push(`  - ${label} - 저장`);
    if (tb.hasDelete) feats.push(`  - ${label} - 삭제`);
    for (const btn of tb.extButtons) feats.push(`  - ${label} - ${btn.name}`);
    return feats;
  });

  // 조회조건/처리조건 항목
  const searchGroups = parseResult.items.conditionGroups.filter((g) => g.groupType === "조회조건");
  const conditionGroups = parseResult.items.conditionGroups.filter((g) => g.groupType === "처리조건");
  const formatControlLabel = (c: ConditionControlInfo) =>
    c.logicHint ? `${c.labelText} (${c.logicHint})` : c.labelText;
  const searchConditionLines = searchGroups
    .map((g, i) => {
      const controls = g.controls.map(formatControlLabel).filter(Boolean).slice(0, 10).join(", ");
      return controls ? `  - ${g.title || `조회조건 ${i + 1}`}: ${controls}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const conditionLines = conditionGroups
    .map((g, i) => {
      const controls = g.controls.map(formatControlLabel).filter(Boolean).slice(0, 10).join(", ");
      return controls ? `  - ${g.title || `처리조건 ${i + 1}`}: ${controls}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const searchConditionLabels = searchGroups
    .flatMap((g) => g.controls.map((c) => c.labelText))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
  const conditionLabels = conditionGroups
    .flatMap((g) => g.controls.map((c) => c.labelText))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  // 그리드 정보 (title 없는 그리드는 제외: 내부 ID가 AI에 노출되는 것을 방지)
  const gridLines = parseResult.items.grids
    .filter((g) => g.columns.length > 0 && g.title)
    .map((g) => {
      const cols = g.columns.slice(0, 8).map((c) => {
        const purpose = c.purpose === "입력" ? "입력" : c.purpose === "표시 또는 입력" ? "표시/입력" : "표시";
        return `${c.headerText}(${purpose})`;
      }).join(", ");
      const options: string[] = [];
      if (g.hasCheckbox) options.push("행 선택 가능");
      if (g.hasState) options.push("변경 상태 표시");
      if (g.sortable) options.push("정렬 가능");
      const suffix = options.length > 0 ? ` / ${options.join(", ")}` : "";
      return `  - ${g.title}: ${cols}${suffix}`;
    })
    .join("\n");

  // 필수값
  const allRequiredTexts = parseResult.notes.requiredFields.flatMap((f) => f.texts);
  const shownRequiredTexts = allRequiredTexts.slice(0, 8);
  const requiredInfo = shownRequiredTexts.join(", ") +
    (allRequiredTexts.length > 8 ? ` 외 ${allRequiredTexts.length - 8}개` : "");

  // 검증 메시지 (inq/save/del 전용 및 완료 메시지 제외 + 버튼명 레이블 포함)
  const VALIDATION_COMPLETION_RE = /^(?:처리|저장|삭제|등록|수정|복사|생성|변경|갱신|적용|실행)[^\n]*?(?:되었습니다|했습니다|하였습니다)[.!]?\s*$/;
  const validationFuncLabelMap = new Map<string, string>();
  for (const btn of parseResult.usage.menuTitleBar.extButtons)
    validationFuncLabelMap.set(btn.functionName, btn.name);
  for (const btn of parseResult.usage.extraButtons)
    validationFuncLabelMap.set(btn.functionName, btn.name);
  const validationMessages = parseResult.notes.validations
    .filter(v => !/inq|inquiry|search|save|del/i.test(v.functionName))
    .filter(v => !VALIDATION_COMPLETION_RE.test(v.message.trim()))
    .slice(0, 8)
    .map((v) => {
      const label = validationFuncLabelMap.get(v.functionName);
      return label ? `  - [${label}] ${v.message}` : `  - ${v.message}`;
    })
    .join("\n");

  // 팝업 정보
  const popupInfo = parseResult.popups
    .map((p) => p.popupUrl.split("/").pop() || p.popupUrl)
    .filter(Boolean)
    .join(", ");

  // 추가 버튼 상세 헬퍼 (logic 우선 → description → 관련 검증 메시지)
  const formatBtnDetail = (btn: ExtButtonInfo) => {
    const logicBlock = buildExtButtonLogicContext(btn);
    if (logicBlock) {
      return `  - ${btn.name}:\n${logicBlock}`;
    }
    if (btn.description) {
      return `  - ${btn.name}:\n${btn.description.split("\n").map(l => "    " + l).join("\n")}`;
    }
    const relatedValidations = parseResult.notes.validations
      .filter((v) => v.message.includes(btn.name) || v.functionName.toLowerCase().includes(btn.functionName.toLowerCase()))
      .map((v) => v.message.replace(/\\n/g, " "))
      .slice(0, 3);
    const detail = relatedValidations.length > 0
      ? ` (관련 검증: ${relatedValidations.join(" / ")})`
      : "";
    return `  - ${btn.name}${detail}`;
  };

  // 추가 버튼 상세 (Form_ext* + 독립 버튼 모두 포함, 동일 이름 중복 제거)
  const allExtraButtons = [
    ...menu.extButtons,
    ...parseResult.usage.extraButtons,
  ];
  const seenBtnNames = new Set<string>();
  const dedupedExtraButtons = allExtraButtons.filter(btn => {
    if (seenBtnNames.has(btn.name)) return false;
    seenBtnNames.add(btn.name);
    return true;
  });
  const extButtonDetails = dedupedExtraButtons.map(formatBtnDetail).join("\n");

  // 그리드 타이틀바 추가 버튼 상세 (logic/description 포함, '타이틀바명 - 버튼명' 라벨)
  const titleBarExtButtonDetails = parseResult.usage.titleBars
    .flatMap((tb) => {
      const label = tb.title || "상세 정보";
      return tb.extButtons.map((btn) => {
        const detail = formatBtnDetail(btn);
        // formatBtnDetail은 "  - {name}..." 형식 → 라벨에 타이틀바명 접두
        return detail.replace(`  - ${btn.name}`, `  - ${label} - ${btn.name}`);
      });
    })
    .join("\n");

  // 컨텍스트 조립
  const contextParts: string[] = [
    `화면명: ${parseResult.overview.programName}`,
    `제공 기능(상단 메뉴 타이틀바): ${features.join(", ")}`,
    `기능 섹션 출력 순서:\n${getUsageSectionTitles(parseResult).map((title, index) => `  ${index + 1}. ${title}`).join("\n")}`,
  ];
  if (titleBarFeatureLines.length > 0) {
    contextParts.push(`제공 기능(그리드 타이틀바):\n${titleBarFeatureLines.join("\n")}`);
  }
  // CRUD 비즈니스 로직 (사전조건/처리/검증/필수입력값/중복불가)
  const menuCrudLogic = buildCrudLogicContext(menu, "상단 메뉴 타이틀바");
  if (menuCrudLogic) contextParts.push(menuCrudLogic);
  for (const tb of parseResult.usage.titleBars) {
    const tbLogic = buildCrudLogicContext(tb, `그리드 타이틀바 - ${tb.title || "상세 정보"}`);
    if (tbLogic) contextParts.push(tbLogic);
  }
  if (searchConditionLabels) contextParts.push(`조회조건 항목: ${searchConditionLabels}`);
  if (conditionLabels) contextParts.push(`처리조건 항목: ${conditionLabels}`);
  if (searchConditionLines) contextParts.push(`조회조건 상세:\n${searchConditionLines}`);
  if (conditionLines) contextParts.push(`처리조건 상세:\n${conditionLines}`);
  if (gridLines) contextParts.push(`결과 목록 상세(그리드):\n${gridLines}`);
  if (requiredInfo) contextParts.push(`필수 입력값: ${requiredInfo}`);
  if (validationMessages) contextParts.push(`검증/주의사항:\n${validationMessages}`);
  if (popupInfo) contextParts.push(`팝업 화면: ${popupInfo}`);
  if (extButtonDetails) contextParts.push(`추가 버튼 상세:\n${extButtonDetails}`);
  if (titleBarExtButtonDetails) contextParts.push(`그리드 타이틀바 추가 버튼 상세:\n${titleBarExtButtonDetails}`);
  if (hasWorkHints(parseResult)) {
    contextParts.push(`작성자 업무 힌트:\n${formatWorkHints(parseResult)}`);
  }

  return [
    {
      role: "system",
      content: `당신은 소프트웨어 사용자 매뉴얼을 작성하는 전문가입니다.
아래 형식에 맞춰 각 기능의 사용방법을 Step별로 작성하세요:
{B}기능 제목{/B}
Step1. 설명
Step2. 설명
...

작성 규칙:
- {B}...{/B} 안의 기능 제목에는 '기능'이라는 단어를 포함하지 마세요. 예: {B}조회{/B}, {B}저장{/B}
- 기능 섹션은 '기능 섹션 출력 순서'에 나열된 순서를 반드시 지키세요. 작성자 업무 힌트는 각 섹션 내부의 Step 구성에만 반영하고 섹션 순서를 바꾸지 마세요
- 기능 소제목은 '기능 섹션 출력 순서'의 이름을 축약하거나 변경하지 말고 그대로 사용하세요
- 각 기능당 Step은 4~6개로 작성하세요 (기능 복잡도에 따라 조절)
- 각 Step은 단순 클릭 안내만 쓰지 말고, 업무 목적·사용자 행동·확인해야 할 결과 중 최소 2가지를 포함하세요
- 각 Step은 이전 Step의 결과를 기반으로 다음 Step이 자연스럽게 이어지도록 연결성을 가지게 작성하세요. 단순 나열 금지
  예시) Step1. 조회할 **학년도**를 선택합니다.
       Step2. 앞서 선택한 학년도에 해당하는 자료를 조회하려면 **조회** 버튼을 클릭합니다.
- 각 Step의 시작 부분에 이전 단계의 수행 결과를 암시하는 연결어(앞서 선택한, 입력한 정보를 확인한 후, 조회된 결과 목록에서 등)를 자연스럽게 포함하세요
  예시) (나쁨) Step1. 저장 버튼을 클릭합니다.
       (좋음) Step1. 입력한 정보를 최종 확인한 후 **저장** 버튼을 클릭합니다.
- 작성자 업무 힌트의 [업무흐름]은 전체 업무 맥락과 Step 순서를 정할 때 우선 참고하세요. 단, 화면에 없는 버튼이나 기능은 새로 만들지 마세요
- 작성자 업무 힌트의 [필수사항]은 조회/신규/저장/처리 Step의 선행조건 또는 확인사항으로 자연스럽게 반영하세요
- 작성자 업무 힌트의 [주의사항]은 해당 기능 Step에서 필요한 경우 간단히 안내하되, 별도 기능으로 만들지 마세요
- 상단 메뉴 타이틀바의 조회: 어떤 업무 대상을 찾는지 설명 → 주요 조회조건 입력 → 조회 버튼 클릭 → 결과 목록의 핵심 컬럼 확인 → 필요한 후속 작업으로 이어지는 흐름으로 작성
- 상단 메뉴 타이틀바의 신규: 새 자료를 등록해야 하는 업무 상황 설명 → 신규 버튼 클릭 → 입력/상세 영역 확인 → 필수 항목 입력 → 저장 전 검토 흐름으로 작성
- 상단 메뉴 타이틀바의 저장: 변경 대상 확인 → 필수값/중복 불가 조건 확인 → 저장 실행 → 저장 후 결과 목록 또는 상세 정보 반영 확인 흐름으로 작성
- 상단 메뉴 타이틀바의 삭제: 삭제 대상 선택 → 삭제 제한/후속 업무 영향 확인 → 삭제 실행 → 결과 목록에서 삭제 여부 확인 흐름으로 작성
- 'CRUD 비즈니스 로직' 블록이 제공된 기능(조회/신규/저장/삭제)은 해당 블록의 사전조건·처리·검증·필수 입력값·중복 불가 내용을 반드시 Step에 반영하세요. 사전조건/검증 메시지는 {MSG}...{/MSG} 형식 그대로 노출하고, 필수 입력값과 중복 불가 조건은 입력/저장 Step에서 안내하세요. 블록이 없는 기능은 위의 일반 흐름을 따르세요
- 사전조건(preconditions)·필수 입력값(requiredFields)·중복 불가(uniqueKeys)가 모두 같은 기능(예: 저장)에 속해 있다면 각각을 별도의 Step으로 분리하지 말고, 업무 흐름상 순서가 가장 적절한 하나의 Step 안에 '행동 안내 → 조건 불충족 시 메시지' 순서로 통합하여 작성하세요
  예시) Step2. 반드시 입력해야 할 항목(교과목코드, 과목명(한글), ...)이 모두 입력되었는지 확인합니다. 누락된 항목이 있으면 저장 시 아래와 같은 메시지가 출력됩니다.
       {MSG}필수 입력 항목을 확인해주시기 바랍니다.{/MSG}
       Step3. **과목명**과 **학과명**의 조합은 중복될 수 없습니다. 이미 등록된 조합이면 저장 시 아래와 같은 메시지가 출력됩니다.
       {MSG}이미 등록된 과목명과 학과명 조합입니다.{/MSG}
- 그리드 타이틀바 기능은 소제목을 반드시 '{B}타이틀바명 - 기능명{/B}' 형식으로 작성하세요. 단, 신규/저장/삭제는 반드시 '제공 기능(그리드 타이틀바)' 목록에 해당 항목이 명시된 경우에만 작성하고, 목록에 없는 기능은 절대 추가하지 마세요
- 각 추가 버튼은 '제공 기능(그리드 타이틀바)'에 명시된 소유 타이틀바에만 작성하세요. 동일한 버튼을 다른 타이틀바 기능으로 추측하여 중복 작성하지 마세요
- 그리드 타이틀바의 저장/삭제도 단순 버튼 클릭으로 끝내지 말고, 대상 목록/행 확인 → 필수값·중복·삭제 제한 조건 확인 → 저장/삭제 실행 → 해당 그리드에서 반영 여부 확인 흐름으로 작성하세요
- 추가 버튼/기타 버튼: 버튼을 사용하는 업무 상황 설명 → 사전 선택 조건 → 버튼 클릭 → 팝업/서버처리/그리드 변경 결과 확인 흐름으로 작성하고, 관련 검증/주의사항이 있으면 Step에 반영하세요
- '추가 버튼 상세' 또는 '그리드 타이틀바 추가 버튼 상세'에 사전조건/검증/확인/처리 항목이 제공된 경우: 사전조건·검증·확인 메시지는 {MSG}...{/MSG} 형식 그대로 해당 Step에 노출하고, 처리 항목은 버튼 클릭 후의 동작 흐름으로 서술하세요. 확인(confirm) 메시지는 "버튼 클릭 시 다음 확인 메시지가 표시되며, 확인을 누르면 진행됩니다.\n{MSG}...{/MSG}" 형식으로 작성하세요
- '추가 버튼 상세'에 나열된 모든 버튼은 반드시 각자 {B}버튼명{/B} 섹션을 가져야 합니다. 누락 없이 모두 포함하세요
- 화면에 제공된 조회조건 항목명, 처리조건 항목명, 그리드명, 그리드 컬럼명을 Step 설명에 직접 활용하세요
- 결과 목록 설명에는 사용자가 무엇을 확인해야 하는지 포함하세요. 예: 목록에서 교과목코드, 교과목명, 폐지 여부를 확인합니다
- 검증/주의사항에 메시지가 있는 경우, 해당 Step에서는 먼저 사용자가 취해야 할 행동을 긍정문(~해야 합니다 / ~합니다)으로 설명하고, 그 다음에 조건 불충족 시 출력되는 메시지를 안내하세요
  형식: "Step N. [사용자가 취해야 할 행동(긍정문)]. [조건을 충족하지 못한 경우] 아래와 같은 메시지가 출력됩니다.\n{MSG}메시지 내용{/MSG}"
  예시1) Step2. 먼저 분반시간표 보기를 선택하여야 합니다. 선택하지 않은 경우 아래와 같은 메시지가 출력됩니다.
         {MSG}분반시간표 보기로 선택하여 시간표변경을 진행해주시기 바랍니다.{/MSG}
  예시2) Step3. 변경할 과목을 시간표에서 선택합니다. 선택하지 않은 경우 아래와 같은 메시지가 출력됩니다.
         {MSG}변경할 과목을 시간표에서 선택해주시기 바랍니다.{/MSG}
  예시3) Step1. 개설년도를 입력합니다. 입력하지 않은 경우 아래와 같은 메시지가 출력됩니다.
         {MSG}개설년도를 입력해주시기 바랍니다.{/MSG}
  예시4 - 필수 입력값이 있는 저장 기능):
       Step3. 반드시 입력해야 할 항목(교과목코드, 과목명(한글), 이수구분, ...)이 모두 입력되었는지 확인합니다. 누락된 항목이 있으면 저장 시 아래와 같은 메시지가 출력됩니다.
       {MSG}필수 입력 항목을 확인해주시기 바랍니다.{/MSG}
  예시5 - 중복 불가 키가 있는 저장 기능):
       Step4. **과목명**과 **학과명**의 조합은 중복될 수 없습니다. 이미 등록된 조합이면 저장 시 아래와 같은 메시지가 출력됩니다.
       {MSG}이미 등록된 과목명과 학과명 조합입니다.{/MSG}
- "XXX 메시지를 확인합니다" 또는 "XXX 메시지가 표시됩니다" 형식은 절대 사용하지 마세요
- 조회조건 항목명, 버튼명, 그리드 컬럼명 등 화면의 고유 명칭을 Step에 언급할 때는 반드시 **항목명** 형식으로 굵게 표시하세요
  예: Step1. **복학년도**와 **복학학기**를 선택한 후 **조회** 버튼을 클릭합니다.
- 한국어로 작성하세요`,
    },
    {
      role: "user",
      content: contextParts.join("\n") + udcHint + "\n\n위 정보를 바탕으로 각 기능의 사용방법을 Step별로 구체적으로 작성해주세요.",
    },
  ];
}

/**
 * 참고사항 AI 변환 프롬프트
 * 시스템 내부 알림 메시지를 사용자 친화적 행동 지침으로 변환
 */
export function buildNotesPrompt(
  programName: string,
  warnings: { label: string; messages: string[] }[]
): AiMessage[] {
  let msgIndex = 0;
  const indexedLines: string[] = [];
  for (const group of warnings) {
    for (const msg of group.messages) {
      msgIndex++;
      indexedLines.push(`${msgIndex}. [${group.label}] ${msg}`);
    }
  }

  return [
    {
      role: "system",
      content: `당신은 업무 시스템 사용자 매뉴얼을 작성하는 전문가입니다.
각 주의사항은 시스템 내부 알림 메시지입니다. 이를 일반 사용자 관점의 행동 지침 또는 업무 규칙 안내 문장으로 변환하세요.

변환 원칙:
1. "~하십시오 / ~바랍니다" 형태 → 사용자가 해야 할 행동을 구체적으로 안내
   예: "개설년도를 선택하시기 바랍니다." → "기능을 실행하기 전에 개설년도를 먼저 선택해야 합니다."
2. "~기간이 아닙니다 / ~할 수 없습니다" 형태 → 업무 규칙을 명시
   예: "반변경기간이 아닙니다." → "반 변경은 지정된 반 변경 기간에만 처리할 수 있습니다."
3. "~이 존재합니다 / ~이 있습니다" 형태 → 처리 전 확인 사항으로 안내
   예: "작성 중인 자료가 존재합니다." → "미저장 데이터가 있습니다. 저장 후 다시 시도하세요."
4. 오류 코드나 시스템 내부 용어는 업무 용어로 바꾸세요.
5. 각 설명은 1~2문장(50자 이내)으로 명확하게 작성하세요.
6. 반드시 "번호. 설명" 형식으로만 응답하세요.`,
    },
    {
      role: "user",
      content: `화면명: ${programName}\n\n주의사항 목록:\n${indexedLines.join("\n")}\n\n각 항목을 사용자가 이해하기 쉬운 행동 지침 또는 업무 규칙 안내 문장으로 변환해주세요.`,
    },
  ];
}
