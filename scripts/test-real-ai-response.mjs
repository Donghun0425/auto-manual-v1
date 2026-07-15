/**
 * 사용자가 제공한 실제 AI 응답으로 렌더링 테스트
 */
import { renderHtml } from "../src/lib/output/html-renderer.ts";
import { renderMarkdown } from "../src/lib/output/markdown-renderer.ts";

// 사용자가 보여준 실제 AI 응답
const realAiUsageText = `{B}조회{/B}
Step1. 휴학 신청 내역을 확인하기 위해 신청년도/신청학기, 휴학년도/휴학학기 정보를 선택하고, 조회할 학생의 학번/성명을 입력합니다.
Step2. 학생 검색 컴포넌트를 통해 조회 대상 학생을 먼저 선택해야 합니다. 선택하지 않은 경우 아래와 같은 메시지가 출력됩니다.
{MSG}학생을 선택해주시기 바랍니다.{/MSG}
Step3. 앞서 입력한 조회 조건과 선택한 학생 정보를 바탕으로 조회 버튼을 클릭합니다.
Step4. 서버 처리 후 나타나는 휴학신청정보 그리드에서 신청 내역과 현재의 진행 상태를 확인합니다.`;

const parseResult = {
  filePath: "sample/usc_3010605_u.clx.js",
  overview: { programName: "휴학신청(학생)", systemName: "학사", subSystem: "학적", description: "test" },
  usage: { menuTitleBar: { hasInquiry: true, hasNew: false, hasSave: false, hasDelete: false, extButtons: [] }, titleBars: [], extraButtons: [] },
  items: { conditionGroups: [], infoGroups: [], grids: [] },
  tabPages: [], popups: [],
  notes: { requiredFields: [], validations: [] },
  aiUsageText: realAiUsageText,
};

const sections = [{ id: "usage", enabled: true, order: 2, options: {} }];

console.log("=== HTML 렌더링 결과 ===\n");
const html = renderHtml(parseResult, sections);
// 사용방법 섹션만 추출
const usageSection = html.match(/<h2>사용방법<\/h2>[\s\S]*?(?=<h2>|$)/)?.[0] || "없음";
console.log(usageSection);

console.log("\n=== MD 렌더링 결과 ===\n");
const md = renderMarkdown(parseResult, sections);
const usageMd = md.match(/## \[.*?\] 사용방법[\s\S]*?(?=##|$)/)?.[0] || "없음";
console.log(usageMd);

// 검증
const stepLines = [...html.matchAll(/<p class="step">(Step\d+\.)/g)].map(m => m[1]);
const msgLines = [...html.matchAll(/<p class="msg-box">/g)];
const boldTags = [...html.matchAll(/<span class="bold-tag">([^<]+)<\/span>/g)].map(m => m[1]);

console.log("\n=== 검증 ===");
console.log("Step 라인:", stepLines);
console.log("MSG 박스:", msgLines.length, "개");
console.log("소제목:", boldTags);
console.log(`Step1 존재: ${stepLines.includes("Step1.")}`);
console.log(`Step2 존재: ${stepLines.includes("Step2.")}`);
console.log(`Step3 존재: ${stepLines.includes("Step3.")}`);
console.log(`Step4 존재: ${stepLines.includes("Step4.")}`);

const allPass = stepLines.includes("Step1.") && stepLines.includes("Step2.") &&
                stepLines.includes("Step3.") && stepLines.includes("Step4.") &&
                boldTags.includes("조회") && msgLines.length === 1;

if (allPass) console.log("\n✅ 모든 검증 통과!");
else {
  console.log("\n❌ 일부 검증 실패");
  process.exit(1);
}
