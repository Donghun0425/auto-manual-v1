/**
 * E2E 테스트: Task 016 - 성능 최적화 및 배포 준비
 * - 다중 파일 병렬 처리 성능 검증
 * - 생성 로그 저장 확인
 * - 에러 재시도 로직 간접 검증
 * - 대시보드 히스토리 표시
 */

const BASE_URL = "http://localhost:3000";

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (!cond) { fail++; console.error(`  ❌ ${msg}`); throw new Error(msg); }
  pass++; console.log(`  ✅ ${msg}`);
}

// ─── Test 1: 다중 파일 병렬 처리 (3개 파일 동시) ─────────────
async function test1_parallelProcessing() {
  console.log("\n--- Test 1: 다중 파일 병렬 처리 ---");

  const files = [
    { path: "test/FILE_A.clx.js", content: "// [프로그램] 파일A\nfunction Form_inqAction() {}" },
    { path: "test/FILE_B.clx.js", content: "// [프로그램] 파일B\nfunction Form_saveAction() {}" },
    { path: "test/FILE_C.clx.js", content: "// [프로그램] 파일C\nfunction Form_delAction() {}" },
  ];

  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files,
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["html", "md"],
    }),
  });
  const elapsed = Date.now() - start;

  assert(res.status === 200, "API → 200");
  const body = await res.json();

  assert(body.results.length === 3, `결과 3개 (실제: ${body.results.length})`);
  assert(body.errors.length === 0, `에러 0개 (실제: ${body.errors.length})`);

  // 각 파일에 htmlContent/markdownContent 있어야 함
  for (const r of body.results) {
    assert(!!r.htmlContent, `${r.fileName} → htmlContent 존재`);
    assert(!!r.markdownContent, `${r.fileName} → markdownContent 존재`);
  }

  // duration 필드
  assert(body.duration > 0, `duration 반환됨: ${body.duration}ms`);
  assert(body.totalTokens >= 0, `totalTokens 정상: ${body.totalTokens}`);

  console.log(`  ⏱ 소요시간: ${elapsed}ms (API duration: ${body.duration}ms)`);
}

// ─── Test 2: 생성 로그 Supabase 저장 확인 ──────────────────
async function test2_generationLog() {
  console.log("\n--- Test 2: 생성 로그 저장 확인 ---");

  // 고유한 파일명으로 테스트
  const uniqueName = `LOG_TEST_${Date.now()}.clx.js`;
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: `test/${uniqueName}`, content: "// [프로그램] 로그테스트\nfunction Form_inqAction() {}" }],
      settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
      useDictionary: false,
      outputFormats: ["html", "md"],
    }),
  });

  assert(res.status === 200, "API → 200");
  const body = await res.json();
  assert(body.results.length === 1, "결과 1개");

  // 잠시 대기 후 대시보드에서 로그 확인
  await new Promise(r => setTimeout(r, 1000));

  const dashRes = await fetch(BASE_URL);
  assert(dashRes.status === 200, "대시보드 로드 성공");
  const dashHtml = await dashRes.text();
  // 로그에 파일명이 표시되어야 함 (서버 렌더링이므로 HTML에 포함)
  assert(dashHtml.includes(uniqueName), `대시보드에 ${uniqueName} 표시`);
}

// ─── Test 3: 에러 핸들링 (잘못된 설정) ─────────────────────
async function test3_errorHandling() {
  console.log("\n--- Test 3: 에러 핸들링 ---");

  // 빈 파일 목록
  const res1 = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [], settings: {}, useDictionary: false, outputFormats: ["html"] }),
  });
  assert(res1.status === 400, "빈 파일 → 400");

  // 잘못된 JSON
  const res2 = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "not json",
  });
  assert(res2.status === 400, "잘못된 JSON → 400");

  // settings 누락
  const res3 = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [{ path: "x.clx.js", content: "test" }], useDictionary: false, outputFormats: ["html"] }),
  });
  assert(res3.status === 400, "settings 누락 → 400");
}

// ─── Test 4: 에러 바운더리 및 로딩 페이지 ───────────────────
async function test4_errorBoundaryAndLoading() {
  console.log("\n--- Test 4: 페이지 로딩 및 에러 처리 ---");

  const pages = ["/", "/generate", "/result", "/dictionary", "/layout-manager"];
  for (const path of pages) {
    const res = await fetch(`${BASE_URL}${path}`);
    assert(res.status === 200, `${path} → HTTP 200`);
  }
}

// ─── Test 5: Vercel 배포 호환성 (빌드 확인) ─────────────────
async function test5_vercelCompat() {
  console.log("\n--- Test 5: 배포 호환성 ---");

  // health 엔드포인트
  const res = await fetch(`${BASE_URL}/api/health`);
  assert(res.status === 200, "/api/health → 200");
  const healthBody = await res.json();
  assert(healthBody.status === "ok", "health status: ok");
}

// ─── 실행 ───────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Task 016: 성능 최적화 및 배포 준비 E2E 테스트");
  console.log("═══════════════════════════════════════════════════");

  await test1_parallelProcessing();
  await test2_generationLog();
  await test3_errorHandling();
  await test4_errorBoundaryAndLoading();
  await test5_vercelCompat();

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  결과: ✅ ${pass} PASS / ❌ ${fail} FAIL`);
  console.log("═══════════════════════════════════════════════════\n");

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
