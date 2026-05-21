/**
 * 프롬프트 엔지니어링 모듈
 * CLX 파싱 결과를 바탕으로 AI에 전달할 프롬프트를 구성
 */
import type { AiMessage, ClxParseResult, GridColumnInfo, ConditionControlInfo } from "@/types";

/** 시스템 프롬프트 (공통) */
const SYSTEM_PROMPT = `당신은 IT 비전문가(학생, 일반 학부모, 교직원 등)가 복잡한 시스템 용어를 쉽게 이해할 수 있도록 돕는 전문 UX 라이터이자 데이터 해설가입니다.
대학 행정 시스템(CLX)의 화면 항목명을 보고, 실제 화면에서 어떤 의미로 쓰이는지 사용자 친화적인 언어로 설명합니다.

작성 규칙:
- 대상 독자: 개발이나 DB 지식이 전혀 없는 일반인입니다.
- 금지 용어: "DB 컬럼", "플래그(Flag)", "불리언(Boolean)", "코드값", "엔티티", "테이블", "스키마", "null", "쿼리" 등 IT 전문 용어는 절대 사용하지 마세요.
- 길이 제한: 각 항목당 2줄 이내로 핵심만 작성하세요.
- 구체성: '누구를 위한 것인지', '어떤 목적으로 쓰이는지'가 명확하게 드러나야 합니다.
- "~합니다" 체 사용`;

/**
 * 그리드 컬럼 설명 생성 프롬프트
 */
export function buildGridColumnPrompt(
  parseResult: ClxParseResult,
  grid: { gridId: string; title: string },
  columns: GridColumnInfo[]
): AiMessage[] {
  const screenContext = `화면명: ${parseResult.overview.programName}, 시스템: ${parseResult.overview.systemName}`;
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
  controls: ConditionControlInfo[]
): AiMessage[] {
  const screenContext = `화면명: ${parseResult.overview.programName}, 시스템: ${parseResult.overview.systemName}`;
  const controlList = controls
    .map((c, i) => `${i + 1}. ${c.labelText} (ID: ${c.controlId}, 타입: ${c.controlType}, ${c.inputType})`)
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

작성 규칙:
- 이 화면의 목적, 주요 기능, 사용 대상을 포함하여 설명하세요.
- 3줄 이내로 작성하되, 각 줄은 줄바꿈(\n)으로 구분하세요.
- 개발 용어(DB, 컬럼, 플래그 등) 없이 일반 사용자 눈높이로 작성하세요.
- 설명 텍스트만 출력하세요. 다른 텍스트는 포함하지 마세요.`,
    },
  ];
}

/**
 * 사용방법 Step별 설명 생성 프롬프트 (v6 호환)
 * {B}기능명{/B} + Step1~N 형식
 */
export function buildUsagePrompt(parseResult: ClxParseResult): AiMessage[] {
  const menu = parseResult.usage.menuTitleBar;

  // 기능 목록 (MenuTitleBar CRUD + 추가 버튼)
  const features: string[] = [];
  if (menu.hasInquiry) features.push("조회");
  if (menu.hasNew) features.push("신규");
  if (menu.hasSave) features.push("저장");
  if (menu.hasDelete) features.push("삭제");
  for (const btn of menu.extButtons) features.push(btn.name);

  // PatisTitleBar 기능 목록
  const titleBarFeatureLines = parseResult.usage.titleBars.flatMap((tb) => {
    const label = tb.title || "상세 정보";
    const feats: string[] = [];
    if (tb.hasNew) feats.push(`  - ${label} 신규`);
    if (tb.hasSave) feats.push(`  - ${label} 저장`);
    if (tb.hasDelete) feats.push(`  - ${label} 삭제`);
    for (const btn of tb.extButtons) feats.push(`  - ${label} - ${btn.name}`);
    return feats;
  });

  // 조회조건/처리조건 항목
  const searchGroups = parseResult.items.conditionGroups.filter((g) => g.groupType === "조회조건");
  const conditionGroups = parseResult.items.conditionGroups.filter((g) => g.groupType === "처리조건");
  const searchConditionLabels = searchGroups
    .flatMap((g) => g.controls.map((c) => c.labelText))
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  const conditionLabels = conditionGroups
    .flatMap((g) => g.controls.map((c) => c.labelText))
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");

  // 그리드 정보
  const gridLines = parseResult.items.grids
    .filter((g) => g.columns.length > 0)
    .map((g) => {
      const title = g.title || g.gridId;
      const cols = g.columns.slice(0, 4).map((c) => c.headerText).join(", ");
      return `  - ${title}: ${cols}`;
    })
    .join("\n");

  // 필수값
  const allRequiredTexts = parseResult.notes.requiredFields.flatMap((f) => f.texts);
  const shownRequiredTexts = allRequiredTexts.slice(0, 4);
  const requiredInfo = shownRequiredTexts.join(", ") +
    (allRequiredTexts.length > 4 ? ` 외 ${allRequiredTexts.length - 4}개` : "");

  // 검증 메시지
  const validationMessages = parseResult.notes.validations
    .slice(0, 8)
    .map((v) => `  - ${v.message}`)
    .join("\n");

  // 팝업 정보
  const popupInfo = parseResult.popups
    .map((p) => p.popupUrl.split("/").pop() || p.popupUrl)
    .filter(Boolean)
    .join(", ");

  // 추가 버튼 상세 (description 우선 사용)
  const extButtonDetails = menu.extButtons
    .map((btn) => {
      if (btn.description) {
        return `  - ${btn.name}:\n${btn.description.split("\n").map(l => "    " + l).join("\n")}`;
      }
      const relatedValidations = parseResult.notes.validations
        .filter((v) => v.message.includes(btn.name) || v.functionName.toLowerCase().includes(`ext${btn.index}`))
        .map((v) => v.message.replace(/\\n/g, " "))
        .slice(0, 3);
      const detail = relatedValidations.length > 0
        ? ` (관련 검증: ${relatedValidations.join(" / ")})`
        : "";
      return `  - ${btn.name}${detail}`;
    })
    .join("\n");

  // 컨텍스트 조립
  const contextParts: string[] = [
    `화면명: ${parseResult.overview.programName}`,
    `제공 기능(상단 메뉴 타이틀바): ${features.join(", ")}`,
  ];
  if (titleBarFeatureLines.length > 0) {
    contextParts.push(`제공 기능(그리드 타이틀바):\n${titleBarFeatureLines.join("\n")}`);
  }
  if (searchConditionLabels) contextParts.push(`조회조건 항목: ${searchConditionLabels}`);
  if (conditionLabels) contextParts.push(`처리조건 항목: ${conditionLabels}`);
  if (gridLines) contextParts.push(`결과 목록(그리드):\n${gridLines}`);
  if (requiredInfo) contextParts.push(`필수 입력값: ${requiredInfo}`);
  if (validationMessages) contextParts.push(`검증/주의사항:\n${validationMessages}`);
  if (popupInfo) contextParts.push(`팝업 화면: ${popupInfo}`);
  if (extButtonDetails) contextParts.push(`추가 버튼 상세:\n${extButtonDetails}`);

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
- {B}...{/B} 안의 기능 제목에는 '기능'이라는 단어를 포함하지 마세요. 예: {B}과목 조회{/B}, {B}저장{/B}
- 각 기능당 Step은 3~5개로 작성하세요 (기능 복잡도에 따라 조절)
- 상단 메뉴 타이틀바의 조회: 조회조건 입력 → 조회 버튼 클릭 → 결과 목록 확인 흐름으로 작성
- 상단 메뉴 타이틀바의 신규/저장: 데이터 입력 → 필수값 확인 → 저장 실행 → 완료 확인 흐름으로 작성
- 상단 메뉴 타이틀바의 삭제: 항목 선택 → 삭제 실행 → 확인 메시지 처리 흐름으로 작성
- 그리드 타이틀바 기능은 소제목을 반드시 '{B}타이틀바명 - 기능명{/B}' 형식으로 작성하세요. 단, 신규/저장/삭제는 반드시 '제공 기능(그리드 타이틀바)' 목록에 해당 항목이 명시된 경우에만 작성하고, 목록에 없는 기능은 절대 추가하지 마세요
- 추가 버튼: 사전 선택 조건 → 버튼 클릭 → 실행 결과 확인 흐름으로 작성하고, 관련 검증/주의사항이 있으면 Step에 반영하세요
- 화면에 제공된 조회조건 항목명, 그리드 컬럼명, 검증 메시지를 Step 설명에 직접 활용하세요
- 한국어로 작성하세요`,
    },
    {
      role: "user",
      content: contextParts.join("\n") + "\n\n위 정보를 바탕으로 각 기능의 사용방법을 Step별로 구체적으로 작성해주세요.",
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
