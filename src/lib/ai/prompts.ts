/**
 * 프롬프트 엔지니어링 모듈
 * CLX 파싱 결과를 바탕으로 AI에 전달할 프롬프트를 구성
 */
import type { AiMessage, ClxParseResult, GridColumnInfo, ConditionControlInfo } from "@/types";

/** 시스템 프롬프트 (공통) */
const SYSTEM_PROMPT = `당신은 기업용 웹 애플리케이션의 사용자 매뉴얼을 작성하는 전문 테크니컬 라이터입니다.
다음 규칙을 따르세요:
- 비개발자(일반 업무 담당자)가 이해할 수 있는 간결하고 명확한 한국어로 작성
- 기술 용어는 피하고, 화면에 보이는 텍스트/라벨 기준으로 설명
- 한 문장은 50자 이내로 유지
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
    .map((c) => `- ${c.headerText} (컬럼ID: ${c.columnName}, 컨트롤: ${c.controlType})`)
    .join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${screenContext}
그리드 "${grid.title}" (ID: ${grid.gridId})의 다음 컬럼들에 대해 사용자가 이해할 수 있는 설명을 작성해주세요.

컬럼 목록:
${columnList}

각 컬럼에 대해 정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:
[{"columnName": "컬럼ID", "description": "설명 (20자 이내)"}]`,
    },
  ];
}

/**
 * 조건그룹 컨트롤 설명 생성 프롬프트
 */
export function buildConditionControlPrompt(
  parseResult: ClxParseResult,
  groupType: string,
  controls: ConditionControlInfo[]
): AiMessage[] {
  const screenContext = `화면명: ${parseResult.overview.programName}, 시스템: ${parseResult.overview.systemName}`;
  const controlList = controls
    .map((c) => `- ${c.labelText} (ID: ${c.controlId}, 타입: ${c.controlType})`)
    .join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${screenContext}
${groupType} 영역의 다음 입력 항목들에 대해 사용자가 이해할 수 있는 설명을 작성해주세요.

항목 목록:
${controlList}

각 항목에 대해 정확히 아래 JSON 배열 형식으로 응답하세요. 다른 텍스트는 포함하지 마세요:
[{"controlId": "항목ID", "description": "설명 (25자 이내)"}]`,
    },
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
      content: `다음 정보를 바탕으로 화면의 용도를 1~2문장으로 간결하게 설명해주세요.

- 화면명: ${parseResult.overview.programName}
- 시스템: ${parseResult.overview.systemName} > ${parseResult.overview.subSystem}
- CRUD 기능: ${features.join(", ") || "없음"}
- 그리드 수: ${gridCount}개
- 조건그룹 수: ${condCount}개
- 탭 페이지: ${parseResult.tabPages.length}개

설명만 출력하세요. 다른 텍스트는 포함하지 마세요.`,
    },
  ];
}
