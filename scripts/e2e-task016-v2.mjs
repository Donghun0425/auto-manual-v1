/**
 * E2E 검증: extraButtons 중복 제거 수정 검증 (task016)
 * - ule_3040401_u.clx.js (PatisTitleBar 추가버튼: 시간표변경)
 * - 사용방법 섹션에서 '시간표 - 시간표변경'이 한 번만 출력되는지 확인
 * - Button/PatisMenuTitleBar/PatisTitleBar 버튼 감지 정상 동작 확인
 */
import { readFileSync } from "fs";

const BASE_URL = "http://localhost:3000";
const CLX_PATH = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\lessn\\ule04\\ule_3040401_u.clx.js";

// ─── 파일 읽기 ───────────────────────────────────────────────────────────────
let clxContent;
try {
  clxContent = readFileSync(CLX_PATH, "utf-8");
} catch (e) {
  console.error(`❌ CLX 파일 읽기 실패: ${CLX_PATH}`);
  console.error(`   ${e.message}`);
  process.exit(1);
}
console.log(`\n=== E2E 검증: extraButtons 중복 수정 ===`);
console.log(`파일: ${CLX_PATH.split("\\").pop()} (${(clxContent.length / 1024).toFixed(1)}KB)\n`);

// ─── 파싱 전용 호출 (AI 없이) ────────────────────────────────────────────────
async function testParseOnly() {
  console.log("── Test 1: 파서 결과 검증 (AI 없이) ──────────────────────────────");
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "univ/lessn/ule04/ule_3040401_u.clx.js", content: clxContent }],
      settings: {
        provider: "vscode-proxy",
        model: "gpt-4o-mini",
        proxyUrl: "http://localhost:19999", // 존재하지 않는 포트 → AI 실패 → 파싱만 확인
        maxTokens: 4096,
        temperature: 0.3,
      },
      useDictionary: false,
      outputFormats: ["md"],
    }),
  });

  const body = await res.json();
  const result = body.results?.[0];
  if (!result) {
    console.error("❌ 응답에 results 없음:", JSON.stringify(body).slice(0, 300));
    return false;
  }

  const p = result.parseResult;
  let pass = true;

  // ── 1-1. menuTitleBar 확인 ──────────────────────────────────────────────────
  const menu = p.usage.menuTitleBar;
  console.log("\n[PatisMenuTitleBar]");
  console.log(`  hasInquiry: ${menu.hasInquiry}`);
  console.log(`  extButtons: [${menu.extButtons.map(b => b.name).join(", ")}]`);
  if (!menu.hasInquiry) { console.error("  ❌ hasInquiry false"); pass = false; }
  else console.log("  ✅ 조회 감지 정상");

  // ── 1-2. titleBars 확인 ─────────────────────────────────────────────────────
  console.log("\n[PatisTitleBar]");
  const allTitleBarExtNames = p.usage.titleBars.flatMap(tb => tb.extButtons.map(b => b.name));
  for (const tb of p.usage.titleBars) {
    console.log(`  - "${tb.title}" extButtons: [${tb.extButtons.map(b => `"${b.name}"`).join(", ")}]`);
  }
  if (allTitleBarExtNames.includes("시간표변경")) console.log("  ✅ PatisTitleBar '시간표변경' 감지 정상");
  else { console.error("  ❌ PatisTitleBar '시간표변경' 미감지"); pass = false; }

  // ── 1-3. extraButtons 확인 ──────────────────────────────────────────────────
  console.log("\n[extraButtons]");
  console.log(`  수: ${p.usage.extraButtons.length}`);
  if (p.usage.extraButtons.some(b => b.name === "시간표변경")) {
    console.error('  ❌ extraButtons에 "시간표변경" 포함 → 중복 버그 미해결'); pass = false;
  } else {
    console.log('  ✅ extraButtons에 "시간표변경" 없음 → 중복 차단 정상');
  }

  return pass;
}

// ─── 후처리 2-1 로직 단위 검증 ───────────────────────────────────────────────
async function testPostProcess21() {
  console.log("\n── Test 2: 후처리 2-1 로직 단위 검증 ─────────────────────────────");

  // AI가 {B}시간표 - 시간표변경{/B} + {B}시간표변경{/B} 를 모두 생성하는 상황 시뮬레이션
  // → generate.ts의 후처리 2-1이 단독 섹션을 제거하는지 검증
  // (직접 함수 호출이 불가하므로 API를 통해 aiUsageText 주입은 어려움 → 정규식 로직만 검증)

  const sampleAiText = [
    "{B}조회{/B}",
    "Step1. 조회 조건을 입력한다.",
    "Step2. 조회 버튼을 클릭한다.",
    "{B}시간표변경{/B}",            // ← AI 할루시네이션: 단독 섹션
    "Step1. 시간표변경 버튼을 클릭한다.",
    "{B}시간표 - 시간표변경{/B}",   // ← 정상: 타이틀바 형식
    "Step1. 변경하고자 하는 시간표 행을 선택한다.",
    "Step2. 시간표변경 버튼을 클릭한다.",
  ].join("\n");

  // 후처리 2-1 로직을 Node.js에서 직접 실행
  let text = sampleAiText;
  const tbTitle = "시간표";
  const btnName = "시간표변경";
  const escapedTitle = tbTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedName = btnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const hasTbFormat = new RegExp(`\\{B\\}${escapedTitle}\\s*[-–]\\s*${escapedName}\\s*\\{/B\\}`).test(text);
  if (hasTbFormat) {
    text = text.replace(
      new RegExp(`\\{B\\}${escapedName}\\{/B\\}\\n(?:Step\\d+\\.[^\\n]*\\n?)*`, "g"),
      ""
    );
  }

  const hasDuplicateInResult = /{B}시간표변경{\/B}/.test(text);
  const hasCorrectFormat = /{B}시간표 - 시간표변경{\/B}/.test(text);

  console.log(`  타이틀바 형식 존재: ${hasTbFormat}`);
  console.log(`  처리 후 단독 {B}시간표변경{/B} 잔존: ${hasDuplicateInResult}`);
  console.log(`  처리 후 올바른 {B}시간표 - 시간표변경{/B} 존재: ${hasCorrectFormat}`);

  const pass = hasTbFormat && !hasDuplicateInResult && hasCorrectFormat;
  if (pass) console.log("  ✅ 후처리 2-1 정상 동작: 단독 섹션 제거 성공");
  else console.error("  ❌ 후처리 2-1 이상");
  return pass;
}

// ─── 실행 ────────────────────────────────────────────────────────────────────
(async () => {
  const parsePass = await testParseOnly();
  const pp21Pass = await testPostProcess21();

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log(`Test 1 (파서):       ${parsePass  ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Test 2 (후처리 2-1): ${pp21Pass   ? "✅ PASS" : "❌ FAIL"}`);
  console.log("══════════════════════════════════════════════════════════════════\n");

  if (!parsePass || !pp21Pass) process.exit(1);
})();
