/**
 * E2E 테스트: 실제 CLX 파일 + VS Code 프록시(localhost:3100)
 * 대상: D:\workspace_pkg2_term (2)\...\usc07\*.clx.js
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const SAMPLE_DIR = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\screg\\usc07";

// 파일 읽기
const files = readdirSync(SAMPLE_DIR)
  .filter((f) => f.endsWith(".clx.js"))
  .map((name) => ({
    path: `univ/screg/usc07/${name}`,
    content: readFileSync(join(SAMPLE_DIR, name), "utf-8"),
    name,
  }));

console.log(`\n=== E2E 테스트: 실제 CLX 파일 (${files.length}개) + VS Code 프록시 ===\n`);
console.log("파일 목록:");
files.forEach((f) => console.log(`  - ${f.name} (${(f.content.length / 1024).toFixed(1)}KB)`));

// ─── Test 1: 파싱만 검증 (AI 없이) ───────────────────────────
async function testParseOnly() {
  console.log("\n--- Test 1: 파싱 전용 (프록시 미사용, 빈 API) ---");

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map((f) => ({ path: f.path, content: f.content })),
      settings: {
        provider: "vscode-proxy",
        model: "gpt-4o-mini",
        proxyUrl: "http://localhost:19999", // 존재하지 않는 포트 → AI 실패, 파싱만 확인
        maxTokens: 4096,
        temperature: 0.3,
      },
      useDictionary: false,
      outputFormats: ["html", "md"],
    }),
  });

  const body = await res.json();
  console.log(`  HTTP: ${res.status}, Results: ${body.results?.length ?? 0}, Errors: ${body.errors?.length ?? 0}`);

  for (const r of body.results ?? []) {
    const p = r.parseResult;
    console.log(`\n  [${r.fileName}]`);
    console.log(`    개요: ${p.overview.systemName} > ${p.overview.subSystem} > ${p.overview.programName}`);
    console.log(`    CRUD: 조회=${p.usage.menuTitleBar.hasInquiry} 신규=${p.usage.menuTitleBar.hasNew} 저장=${p.usage.menuTitleBar.hasSave} 삭제=${p.usage.menuTitleBar.hasDelete}`);
    console.log(`    추가버튼: ${p.usage.menuTitleBar.extButtons?.length ?? 0}개`);
    if (p.usage.menuTitleBar.extButtons?.length > 0) {
      p.usage.menuTitleBar.extButtons.slice(0, 3).forEach((b) => console.log(`      - ${b.name} (${b.functionName})`));
    }
    console.log(`    그리드: ${p.items.grids.length}개`);
    if (p.items.grids.length > 0) {
      p.items.grids.forEach((g) => console.log(`      - ${g.gridId}: "${g.title}" (${g.columns.length}컬럼)`));
    }
    console.log(`    조건그룹: ${p.items.conditionGroups.length}개`);
    console.log(`    인포그룹: ${p.items.infoGroups.length}개`);
    console.log(`    필수값: ${p.notes.requiredFields.length}건, Alert: ${p.notes.validations.length}건`);
    console.log(`    팝업: ${p.popups.length}개, 탭: ${p.tabPages.length}개`);
  }

  // 기본 검증: 파싱 결과가 있어야 함
  const passCount = (body.results ?? []).filter((r) => r.parseResult.overview.programName).length;
  console.log(`\n  ✅ 파싱 성공: ${body.results?.length ?? 0}/${files.length} 파일 (개요 추출: ${passCount}개)`);
  return body.results?.length ?? 0;
}

// ─── Test 2: 실제 프록시 AI 생성 (1개 파일) ──────────────────
async function testWithProxy() {
  console.log("\n--- Test 2: VS Code 프록시 AI 생성 (가장 작은 파일 1개) ---");

  // 가장 작은 파일 선택
  const smallest = files.reduce((a, b) => (a.content.length < b.content.length ? a : b));
  console.log(`  대상: ${smallest.name} (${(smallest.content.length / 1024).toFixed(1)}KB)`);

  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: smallest.path, content: smallest.content }],
      settings: {
        provider: "vscode-proxy",
        model: "gpt-4o-mini",
        proxyUrl: "http://localhost:3100",
        maxTokens: 4096,
        temperature: 0.3,
      },
      useDictionary: false,
      outputFormats: ["html", "md"],
    }),
  });
  const elapsed = Date.now() - startTime;

  const body = await res.json();
  console.log(`  HTTP: ${res.status} (${(elapsed / 1000).toFixed(1)}초)`);
  console.log(`  Results: ${body.results?.length ?? 0}, Errors: ${body.errors?.length ?? 0}`);

  if (body.errors?.length > 0) {
    console.log(`  ⚠️ Error: ${body.errors[0].message.substring(0, 100)}`);
  }

  if (body.results?.length > 0) {
    const r = body.results[0];
    const p = r.parseResult;
    console.log(`\n  [결과: ${r.fileName}]`);
    console.log(`    토큰 사용: ${r.tokenUsage.total_tokens}`);
    console.log(`    개요: ${p.overview.programName}`);
    console.log(`    화면설명: ${p.overview.description?.substring(0, 80) || "(미생성)"}`);

    // 그리드 컬럼 설명 확인
    if (p.items.grids.length > 0) {
      const firstGrid = p.items.grids[0];
      const withDesc = firstGrid.columns.filter((c) => c.description);
      console.log(`    그리드 "${firstGrid.title}": ${withDesc.length}/${firstGrid.columns.length} 컬럼 설명 생성됨`);
      withDesc.slice(0, 3).forEach((c) => console.log(`      - ${c.headerText}: ${c.description}`));
    }

    // 조건그룹 컨트롤 설명 확인
    if (p.items.conditionGroups.length > 0) {
      const firstCg = p.items.conditionGroups[0];
      const withDesc = firstCg.controls.filter((c) => c.description);
      console.log(`    조건그룹: ${withDesc.length}/${firstCg.controls.length} 항목 설명 생성됨`);
      withDesc.slice(0, 3).forEach((c) => console.log(`      - ${c.labelText}: ${c.description}`));
    }

    console.log(`\n  ✅ AI 생성 성공 (토큰: ${r.tokenUsage.total_tokens}, 시간: ${(elapsed / 1000).toFixed(1)}초)`);
  }
}

// ─── Test 3: 전체 4개 파일 일괄 생성 ─────────────────────────
async function testBatchGeneration() {
  console.log("\n--- Test 3: 전체 4개 파일 일괄 AI 생성 ---");

  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map((f) => ({ path: f.path, content: f.content })),
      settings: {
        provider: "vscode-proxy",
        model: "gpt-4o-mini",
        proxyUrl: "http://localhost:3100",
        maxTokens: 4096,
        temperature: 0.3,
      },
      useDictionary: true,
      outputFormats: ["html", "md"],
    }),
  });
  const elapsed = Date.now() - startTime;

  const body = await res.json();
  console.log(`  HTTP: ${res.status} (${(elapsed / 1000).toFixed(1)}초)`);
  console.log(`  Results: ${body.results?.length ?? 0}, Errors: ${body.errors?.length ?? 0}`);
  console.log(`  Total Tokens: ${body.totalTokens}`);

  for (const r of body.results ?? []) {
    console.log(`    ✅ ${r.fileName} — tokens: ${r.tokenUsage.total_tokens}`);
  }
  for (const e of body.errors ?? []) {
    console.log(`    ❌ ${e.fileName}: ${e.message.substring(0, 80)}`);
  }

  if ((body.results?.length ?? 0) > 0) {
    console.log(`\n  ✅ 일괄 생성 완료: ${body.results.length}/${files.length} 성공, ${elapsed / 1000}초, ${body.totalTokens} 토큰`);
  }
}

// ─── 실행 ─────────────────────────────────────────────────────
async function main() {
  await testParseOnly();
  await testWithProxy();
  await testBatchGeneration();
  console.log("\n=== 모든 E2E 테스트 완료 ===\n");
}

main().catch((err) => {
  console.error("\n❌ FATAL:", err.message);
  process.exit(1);
});
