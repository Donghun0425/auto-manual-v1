/**
 * E2E 테스트: Task 015 - HTML/MD 매뉴얼 출력 엔진
 * - HTML 렌더링 검증 (레이아웃 반영)
 * - Markdown 렌더링 검증
 * - 섹션 순서/포함 제외 반영 확인
 * - 다운로드 가능한 콘텐츠 생성 확인
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const SAMPLE_DIR = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\screg\\usc07";

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.error(`  ❌ ${msg}`); throw new Error(msg); }
  pass++; console.log(`  ✅ ${msg}`);
}

// ─── Test 1: 기본 레이아웃으로 HTML/MD 생성 ─────────────────
async function test1_defaultLayout() {
  console.log("\n--- Test 1: 기본 레이아웃 HTML/MD 생성 ---");

  const content = `
// [시스템명] 학사관리시스템
// [부시스템] 수강관리
// [프로그램] 수강신청 관리
// [설명] 학생 수강신청을 관리하는 화면
// [작성자명] 홍길동
// [작성일자] 2024.01.15

function Form_inqAction() {}
function Form_saveAction() {}

PatisUtils.setAppProperty(app, app.lookup("grd_list"), "requiredColumn", new Array("STDT_NO","SUBJ_CD"));
PatisUtils.setAppProperty(app, app.lookup("grd_list"), "requiredText", new Array("학번","과목코드"));

scwin.validations = function() { alert("학과코드를 입력하세요."); };
`;

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "test/HAKSA001.clx.js", content }],
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["html", "md"],
    }),
  });

  assert(res.status === 200, "API → 200");
  const body = await res.json();
  const r = body.results[0];

  // HTML 검증
  assert(!!r.htmlContent, "htmlContent 존재");
  assert(r.htmlContent.includes("<!DOCTYPE html>"), "HTML doctype");
  assert(r.htmlContent.includes("수강신청 관리"), "HTML에 프로그램명 포함");
  assert(r.htmlContent.includes("학사관리시스템"), "HTML에 시스템명 포함");
  assert(r.htmlContent.includes("화면개요"), "HTML에 화면개요 섹션");
  assert(r.htmlContent.includes("사용법"), "HTML에 사용법 섹션");
  assert(r.htmlContent.includes("주의사항"), "HTML에 주의사항 섹션");
  assert(r.htmlContent.includes("학번"), "HTML에 필수값 항목");
  assert(r.htmlContent.includes("<table>"), "HTML 테이블 존재");
  assert(r.htmlContent.includes("<style>"), "HTML 스타일 포함 (독립형)");

  // MD 검증
  assert(!!r.markdownContent, "markdownContent 존재");
  assert(r.markdownContent.includes("# 수강신청 관리"), "MD 타이틀");
  assert(r.markdownContent.includes("## 화면개요"), "MD 화면개요 섹션");
  assert(r.markdownContent.includes("## 사용법"), "MD 사용법 섹션");
  assert(r.markdownContent.includes("## 주의사항"), "MD 주의사항 섹션");
  assert(r.markdownContent.includes("| 조회 |"), "MD 조회 기능 행");
  assert(r.markdownContent.includes("학번"), "MD 필수값 항목");

  console.log(`  HTML 크기: ${(r.htmlContent.length / 1024).toFixed(1)}KB`);
  console.log(`  MD 크기: ${(r.markdownContent.length / 1024).toFixed(1)}KB`);
}

// ─── Test 2: 커스텀 레이아웃 (섹션 제외/순서 변경) ──────────
async function test2_customLayout() {
  console.log("\n--- Test 2: 커스텀 레이아웃 (섹션 제외/순서 변경) ---");

  const content = `
// [시스템명] 테스트시스템
// [프로그램] 커스텀 테스트

function Form_inqAction() {}
function Form_saveAction() {}
function Form_delAction() {}

PatisUtils.setAppProperty(app, app.lookup("grd1"), "requiredColumn", new Array("COL1"));
PatisUtils.setAppProperty(app, app.lookup("grd1"), "requiredText", new Array("컬럼1"));
`;

  // 사용법만 포함하고 순서를 notes → usage로 변경
  const customSections = [
    { id: "notes", name: "주의사항", enabled: true, order: 0 },
    { id: "usage", name: "사용법", enabled: true, order: 1, options: { customTitle: "기능 버튼 안내" } },
    { id: "overview", name: "화면개요", enabled: false, order: 2 },
    { id: "conditions", name: "조건그룹", enabled: false, order: 3 },
    { id: "info", name: "인포그룹", enabled: false, order: 4 },
    { id: "grid", name: "그리드", enabled: false, order: 5 },
    { id: "popup", name: "팝업", enabled: false, order: 6 },
    { id: "tabs", name: "탭페이지", enabled: false, order: 7 },
  ];

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "test/CUSTOM.clx.js", content }],
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["html", "md"],
      layoutSections: customSections,
    }),
  });

  const body = await res.json();
  const r = body.results[0];

  // 화면개요는 제외
  assert(!r.htmlContent.includes("화면개요"), "HTML에 화면개요 없음 (disabled)");
  assert(!r.markdownContent.includes("## 화면개요"), "MD에 화면개요 없음");

  // 그리드/조건그룹/팝업 제외
  assert(!r.htmlContent.includes("그리드"), "HTML에 그리드 없음");
  assert(!r.htmlContent.includes("조건그룹"), "HTML에 조건그룹 없음");

  // 사용법 포함 (커스텀 타이틀)
  assert(r.htmlContent.includes("기능 버튼 안내"), "HTML 커스텀 타이틀 적용");
  assert(r.markdownContent.includes("## 기능 버튼 안내"), "MD 커스텀 타이틀 적용");

  // 주의사항이 사용법보다 먼저 나와야 함 (order: 0 vs 1)
  const htmlNotesIdx = r.htmlContent.indexOf("주의사항");
  const htmlUsageIdx = r.htmlContent.indexOf("기능 버튼 안내");
  assert(htmlNotesIdx < htmlUsageIdx, "HTML: 주의사항이 사용법보다 먼저 출력");

  const mdNotesIdx = r.markdownContent.indexOf("## 주의사항");
  const mdUsageIdx = r.markdownContent.indexOf("## 기능 버튼 안내");
  assert(mdNotesIdx < mdUsageIdx, "MD: 주의사항이 사용법보다 먼저 출력");
}

// ─── Test 3: 실제 파일로 HTML/MD 생성 (프록시 사용) ─────────
async function test3_realFile() {
  console.log("\n--- Test 3: 실제 CLX 파일 HTML/MD 생성 ---");

  if (!existsSync(SAMPLE_DIR)) {
    console.log("  ⚠️  실제 파일 경로 미발견 — 스킵");
    return;
  }

  const fileName = "usc_3010703_b.clx.js"; // 가장 작은 파일
  const filePath = join(SAMPLE_DIR, fileName);
  const content = readFileSync(filePath, "utf-8");

  // 프록시 가용 확인
  let proxyUrl = "http://localhost:19999";
  try {
    const proxyRes = await fetch("http://localhost:3100", { signal: AbortSignal.timeout(2000) });
    if (proxyRes.ok) proxyUrl = "http://localhost:3100";
  } catch {}

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: `usc07/${fileName}`, content }],
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl, maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["html", "md"],
    }),
  });

  const body = await res.json();
  assert(body.results?.length === 1, "결과 1개");

  const r = body.results[0];
  assert(!!r.htmlContent, "htmlContent 생성됨");
  assert(!!r.markdownContent, "markdownContent 생성됨");
  assert(r.htmlContent.includes("<!DOCTYPE html>"), "완전한 HTML 문서");
  assert(r.htmlContent.length > 1000, `HTML 충분한 크기 (${(r.htmlContent.length / 1024).toFixed(1)}KB)`);
  assert(r.markdownContent.startsWith("#"), "MD 헤더로 시작");

  // 그리드 섹션이 있어야 함 (실제 파일은 그리드를 가짐)
  if (r.parseResult.items.grids.length > 0) {
    assert(r.htmlContent.includes("그리드"), "HTML에 그리드 섹션 포함");
    assert(r.markdownContent.includes("## 그리드"), "MD에 그리드 섹션 포함");

    const grid = r.parseResult.items.grids[0];
    assert(r.htmlContent.includes(grid.title), `HTML에 그리드 제목 "${grid.title}" 포함`);
  }

  console.log(`  HTML: ${(r.htmlContent.length / 1024).toFixed(1)}KB, MD: ${(r.markdownContent.length / 1024).toFixed(1)}KB`);
}

// ─── Test 4: HTML만 / MD만 출력 포맷 제한 ───────────────────
async function test4_singleFormat() {
  console.log("\n--- Test 4: 단일 출력 포맷 (HTML만, MD만) ---");

  const content = `// [프로그램] 포맷테스트\nfunction Form_inqAction() {}`;

  // HTML만
  const res1 = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "test.clx.js", content }],
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["html"],
    }),
  });
  const b1 = await res1.json();
  assert(!!b1.results[0].htmlContent, "HTML only → htmlContent 있음");
  assert(!b1.results[0].markdownContent, "HTML only → markdownContent 없음");

  // MD만
  const res2 = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "test.clx.js", content }],
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["md"],
    }),
  });
  const b2 = await res2.json();
  assert(!b2.results[0].htmlContent, "MD only → htmlContent 없음");
  assert(!!b2.results[0].markdownContent, "MD only → markdownContent 있음");
}

// ─── Test 5: 결과 페이지 로드 ───────────────────────────────
async function test5_resultPage() {
  console.log("\n--- Test 5: 결과 페이지 로드 ---");
  const res = await fetch(`${BASE_URL}/result`);
  assert(res.status === 200, "/result → HTTP 200");
  const html = await res.text();
  assert(html.includes("분석 결과"), "분석 결과 탭 존재");
  assert(html.includes("HTML 미리보기"), "HTML 미리보기 탭 존재");
  assert(html.includes("Markdown"), "Markdown 탭 존재");
}

// ─── 실행 ───────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Task 015: HTML/MD 매뉴얼 출력 엔진 E2E 테스트");
  console.log("═══════════════════════════════════════════════════");

  await test1_defaultLayout();
  await test2_customLayout();
  await test3_realFile();
  await test4_singleFormat();
  await test5_resultPage();

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  결과: ✅ ${pass} PASS / ❌ ${fail} FAIL`);
  console.log("═══════════════════════════════════════════════════\n");

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
