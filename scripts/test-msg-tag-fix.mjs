/**
 * {MSG} 블록 내 Step 소실 버그 수정 검증
 * usc_3010605_u.clx.js의 실제 패턴으로 테스트
 */
import { renderHtml } from "../src/lib/output/html-renderer.ts";
import { renderMarkdown } from "../src/lib/output/markdown-renderer.ts";

// usc_3010605_u.clx.js의 AI 출력 시뮬레이션 (MSG 블록 안에 Step이 갇힌 패턴)
const parseResult = {
  filePath: "sample/usc_3010605_u.clx.js",
  overview: {
    programName: "휴학신청(학생)",
    systemName: "학사",
    subSystem: "학적",
    description: "테스트",
  },
  usage: {
    menuTitleBar: {
      hasInquiry: true, hasNew: false, hasSave: false, hasDelete: false,
      extButtons: [],
    },
    titleBars: [],
    extraButtons: [],
  },
  items: { conditionGroups: [], infoGroups: [], grids: [] },
  tabPages: [],
  popups: [],
  notes: { requiredFields: [], validations: [] },
  // 핵심: AI가 생성한 텍스트 - {MSG} 블록 안에 Step3~5가 갇혀있는 패턴
  aiUsageText: `{B}조회{/B}
Step1. **신청년도**와 **신청학기**를 선택합니다.
Step2. **학생검색**에서 학생을 선택한 후 **조회** 버튼을 클릭합니다.
{MSG}휴학신청기간이 아닙니다.
Step3. 앞서 조회된 결과 목록에서 **휴학년도**, **휴학학기**, **복학예정년도**를 확인합니다.
{MSG}다른 변동 신청건이 존재합니다.
Step4. 등록금 납부 여부에 따라 신청 가능 여부를 확인합니다.
{MSG}연기/분납 신청자일 경우 등록금을 모두 납부후 신청이 가능합니다.
Step5. 확인 후 **휴학원출력** 또는 **신청** 버튼을 클릭합니다.{/MSG}`,
};

const sections = [
  { id: "usage", enabled: true, order: 2, options: {} },
];

console.log("=== HTML 렌더링 결과 ===\n");
const html = renderHtml(parseResult, sections);
console.log(html);

console.log("\n=== MD 렌더링 결과 ===\n");
const md = renderMarkdown(parseResult, sections);
console.log(md);

// 검증: Step3, Step4, Step5가 msg-box 대신 step으로 출력되었는지 확인
const stepCounts = [...html.matchAll(/<p class="step">Step\d+\./g)].length;
const msgBoxCounts = [...html.matchAll(/<p class="msg-box">/g)].length;

console.log(`\n=== 검증 ===`);
console.log(`Step 라인 수: ${stepCounts} (기대: 5)`);
console.log(`MSG 박스 수: ${msgBoxCounts} (기대: 3)`);

let pass = true;
if (stepCounts < 5) { console.error("❌ Step 라인이 소실되었습니다!"); pass = false; }
if (msgBoxCounts !== 3) { console.error(`❌ MSG 박스 수 불일치: ${msgBoxCounts}`); pass = false; }
if (pass) console.log("✅ 모든 검증 통과 – Step 소실 버그 해결됨");
else process.exit(1);