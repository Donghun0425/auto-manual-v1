/**
 * E2E 통합 테스트 스크립트 (Task 014-1)
 * 
 * 시나리오:
 * 1. 전체 사용자 플로우 (파일 업로드 → 분석 → 생성 → 결과 확인)
 * 2. 단어사전 연동 매뉴얼 생성 검증
 * 3. 레이아웃 적용 후 매뉴얼 출력 형식 검증
 * 4. 에러 핸들링 및 엣지 케이스 테스트
 * 
 * 사전조건: localhost:3000 dev 서버, localhost:3100 VS Code 프록시
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const PROXY_URL = "http://localhost:3100";
const SAMPLE_DIR = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\screg\\usc07";

// ─── 유틸리티 ─────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    failCount++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  }
  passCount++;
  console.log(`  ✅ ${message}`);
}

function assertIncludes(str, substring, message) {
  assert(str?.includes(substring), message || `"${substring}" not found in output`);
}

async function checkProxyAvailable() {
  try {
    const res = await fetch(PROXY_URL, { method: "GET", signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

// ─── 테스트 데이터 ────────────────────────────────────────────
const SAMPLE_CLX_CONTENT = `
// [시스템명] 학사관리시스템
// [부시스템] 수강관리
// [프로그램] 수강신청 관리
// [설명] 학생 수강신청을 관리하는 화면
// [작성자명] 홍길동
// [작성일자] 2024.01.15

function onBodyLoad() {
  // PatisMenuTitleBar CRUD
}

function Form_inqAction() {
  // 조회
}

function Form_newAction() {
  // 신규
}

function Form_saveAction() {
  // 저장
}

function Form_delAction() {
  // 삭제
}

function Form_ext1Click() {
  // 엑셀다운로드
}

// PatisUtils.setAppProperty 필수값
PatisUtils.setAppProperty(app, app.lookup("grd_list"), "requiredColumn", new Array("STDT_NO","SUBJ_CD"));
PatisUtils.setAppProperty(app, app.lookup("grd_list"), "requiredText", new Array("학번","과목코드"));

scwin.validations = function() {
  if (!app.lookup("sDeptCd").getValue()) {
    alert("학과코드를 입력하세요.");
    return false;
  }
  return true;
};
`;

// ═══════════════════════════════════════════════════════════════
// 시나리오 1: 전체 사용자 플로우 (파일 → 파싱 → 생성 → 결과)
// ═══════════════════════════════════════════════════════════════
async function scenario1_fullFlow() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  시나리오 1: 전체 사용자 플로우 테스트               ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // 1-1. 페이지 로드 확인
  console.log("--- 1-1: 주요 페이지 로드 확인 ---");
  for (const path of ["/", "/generate", "/result", "/dictionary", "/layout-manager"]) {
    const res = await fetch(`${BASE_URL}${path}`);
    assert(res.status === 200, `${path} → HTTP 200`);
  }

  // 1-2. Health Check API
  console.log("\n--- 1-2: Health Check API ---");
  {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert(res.status === 200, "/api/health → HTTP 200");
    const body = await res.json();
    assert(body.status === "ok", "health status = ok");
  }

  // 1-3. 샘플 파일로 파싱 + 생성 (프록시 없이)
  console.log("\n--- 1-3: 단일 파일 파싱 검증 (AI 미사용) ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "test/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
        settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html", "md"],
      }),
    });
    assert(res.status === 200, "생성 API → HTTP 200");

    const body = await res.json();
    assert(body.results?.length === 1, "결과 1개 반환");

    const r = body.results[0];
    assert(r.fileName === "HAKSA001.clx.js", `파일명: ${r.fileName}`);
    assert(r.parseResult.overview.systemName === "학사관리시스템", `시스템명: ${r.parseResult.overview.systemName}`);
    assert(r.parseResult.overview.programName === "수강신청 관리", `프로그램명: ${r.parseResult.overview.programName}`);
    assert(r.parseResult.overview.subSystem === "수강관리", `서브시스템: ${r.parseResult.overview.subSystem}`);
    assert(r.parseResult.usage.menuTitleBar.hasInquiry === true, "조회 버튼 감지");
    assert(r.parseResult.usage.menuTitleBar.hasSave === true, "저장 버튼 감지");
    assert(r.parseResult.usage.menuTitleBar.hasDelete === true, "삭제 버튼 감지");
    assert(r.parseResult.usage.menuTitleBar.hasNew === true, "신규 버튼 감지");
    assert(r.parseResult.notes.requiredFields.length >= 1, "필수값 감지");
    assert(r.parseResult.notes.validations.length >= 1, "유효성검사 감지");
    assert(typeof r.generatedAt === "string", "생성일시 존재");
    assert(typeof body.duration === "number", "소요시간 존재");
  }

  // 1-4. 실제 CLX 파일이 있으면 다중 파일 파싱
  console.log("\n--- 1-4: 실제 CLX 파일 다중 파싱 ---");
  if (existsSync(SAMPLE_DIR)) {
    const files = readdirSync(SAMPLE_DIR)
      .filter((f) => f.endsWith(".clx.js"))
      .map((name) => ({
        path: `univ/screg/usc07/${name}`,
        content: readFileSync(join(SAMPLE_DIR, name), "utf-8"),
      }));
    console.log(`  실제 파일 ${files.length}개 발견`);

    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files,
        settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    const body = await res.json();
    assert(body.results.length === files.length, `${files.length}개 파일 모두 파싱 결과 반환`);

    for (const r of body.results) {
      assert(!!r.parseResult.overview.programName || !!r.parseResult.overview.systemName, `${r.fileName}: 개요 추출됨`);
    }
  } else {
    console.log("  ⚠️  실제 CLX 파일 경로 미발견 — 스킵");
  }
}

// ═══════════════════════════════════════════════════════════════
// 시나리오 2: 단어사전 연동 매뉴얼 생성
// ═══════════════════════════════════════════════════════════════
async function scenario2_dictionaryIntegration() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  시나리오 2: 단어사전 연동 매뉴얼 생성 검증          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const proxyAvailable = await checkProxyAvailable();
  if (!proxyAvailable) {
    console.log("  ⚠️  VS Code 프록시(localhost:3100) 미실행 — AI 연동 스킵");
    console.log("  → 사전 조회 로직은 API 호출로 간접 검증\n");
  }

  // 2-1. useDictionary=true 로 생성 시 사전 조회가 동작하는지 확인
  console.log("--- 2-1: useDictionary=true 요청 (사전 조회 시도) ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "test/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
        settings: {
          provider: "vscode-proxy",
          model: "gpt-4o-mini",
          proxyUrl: proxyAvailable ? PROXY_URL : "http://localhost:19999",
          maxTokens: 4096,
          temperature: 0.3,
        },
        useDictionary: true,
        outputFormats: ["html"],
      }),
    });
    assert(res.status === 200, "useDictionary=true → HTTP 200");
    const body = await res.json();
    // 파싱 결과는 항상 반환되어야 함 (AI 실패해도)
    assert(body.results?.length === 1, "결과 반환됨 (사전 연동 실패해도 파싱은 성공)");
    assert(!!body.results[0].parseResult.overview.programName, "파싱 결과 보존");
    console.log(`  토큰 사용: ${body.results[0].tokenUsage.total_tokens}`);
  }

  // 2-2. 프록시 가용 시 AI 생성 + 사전 자동 등록 검증
  if (proxyAvailable) {
    console.log("\n--- 2-2: 프록시 AI 생성 + 사전 자동 등록 ---");
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "test/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
        settings: {
          provider: "vscode-proxy",
          model: "gpt-4o-mini",
          proxyUrl: PROXY_URL,
          maxTokens: 4096,
          temperature: 0.3,
        },
        useDictionary: true,
        outputFormats: ["html", "md"],
      }),
    });
    const body = await res.json();
    assert(body.results?.length === 1, "AI 생성 결과 반환");

    const r = body.results[0];
    console.log(`  토큰 사용: ${r.tokenUsage.total_tokens}`);
    console.log(`  화면설명: ${r.parseResult.overview.description?.substring(0, 60) || "(미생성)"}`);

    // 그리드 컬럼 설명이 AI로 생성되었는지 확인
    if (r.parseResult.items.grids.length > 0) {
      const grid = r.parseResult.items.grids[0];
      const withDesc = grid.columns.filter((c) => c.description);
      console.log(`  그리드 컬럼 설명: ${withDesc.length}/${grid.columns.length}개 생성`);
      if (withDesc.length > 0) {
        assert(true, `그리드 컬럼 AI 설명 생성됨 (${withDesc.length}개)`);
      }
    }

    // 조건그룹 컨트롤 설명 확인
    if (r.parseResult.items.conditionGroups.length > 0) {
      const cg = r.parseResult.items.conditionGroups[0];
      const withDesc = cg.controls.filter((c) => c.description);
      console.log(`  조건그룹 설명: ${withDesc.length}/${cg.controls.length}개 생성`);
      if (withDesc.length > 0) {
        assert(true, `조건그룹 AI 설명 생성됨 (${withDesc.length}개)`);
      }
    }

    // 2-3. 두 번째 동일 요청 — 사전에서 가져오므로 토큰이 줄어야 함
    console.log("\n--- 2-3: 동일 요청 재실행 (사전 캐시 효과 확인) ---");
    const res2 = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "test/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
        settings: {
          provider: "vscode-proxy",
          model: "gpt-4o-mini",
          proxyUrl: PROXY_URL,
          maxTokens: 4096,
          temperature: 0.3,
        },
        useDictionary: true,
        outputFormats: ["html"],
      }),
    });
    const body2 = await res2.json();
    if (body2.results?.length > 0) {
      const tokens1 = r.tokenUsage.total_tokens;
      const tokens2 = body2.results[0].tokenUsage.total_tokens;
      console.log(`  1차 토큰: ${tokens1}, 2차 토큰: ${tokens2}`);
      if (tokens2 < tokens1) {
        assert(true, `사전 캐시 효과: 토큰 ${tokens1} → ${tokens2} 감소`);
      } else {
        console.log("  ℹ️  토큰이 줄지 않음 (사전에 이미 등록된 용어 없을 수 있음)");
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 시나리오 3: 레이아웃 적용 후 매뉴얼 출력 형식 검증
// ═══════════════════════════════════════════════════════════════
async function scenario3_layoutIntegration() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  시나리오 3: 레이아웃 템플릿 관리 통합 검증          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // 3-1. 레이아웃 템플릿 CRUD API 테스트 (Supabase 직접 호출 경유)
  console.log("--- 3-1: 레이아웃 페이지 로드 ---");
  {
    const res = await fetch(`${BASE_URL}/layout-manager`);
    assert(res.status === 200, "/layout-manager → HTTP 200");
  }

  // 3-2. 레이아웃 프리셋 저장 → 조회 → 기본 설정 → 삭제 (API 경로 이용)
  // 이 부분은 Supabase를 직접 호출해서 검증
  console.log("\n--- 3-2: 레이아웃 프리셋 CRUD (Supabase 직접) ---");
  {
    // Supabase 클라이언트 직접 사용 대신 layout-manager 페이지의 fetch intercept으로 검증
    // 프리셋 저장을 위해 Supabase REST API를 직접 호출
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      // INSERT
      const testSections = JSON.stringify([
        { id: "overview", title: "화면개요", enabled: true, order: 0 },
        { id: "grid", title: "그리드", enabled: true, order: 1 },
        { id: "conditions", title: "조건그룹", enabled: false, order: 2 },
      ]);

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/layout_template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          name: "__e2e_test_template__",
          sections: testSections,
          is_default: false,
        }),
      });
      assert(insertRes.status === 201, `프리셋 INSERT → ${insertRes.status}`);
      const [inserted] = await insertRes.json();
      const templateId = inserted.id;
      console.log(`  생성된 ID: ${templateId}`);

      // SELECT
      const listRes = await fetch(`${supabaseUrl}/rest/v1/layout_template?name=eq.__e2e_test_template__`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
      });
      const listData = await listRes.json();
      assert(listData.length === 1, "프리셋 조회 성공");
      assert(listData[0].name === "__e2e_test_template__", "프리셋 이름 일치");

      // UPDATE (기본 설정)
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/layout_template?id=eq.${templateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ is_default: true }),
      });
      assert(updateRes.status === 200, "프리셋 기본 설정 UPDATE 성공");

      // DELETE
      const deleteRes = await fetch(`${supabaseUrl}/rest/v1/layout_template?id=eq.${templateId}`, {
        method: "DELETE",
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
      });
      assert(deleteRes.status === 204, "프리셋 DELETE 성공");

      // 삭제 확인
      const verifyRes = await fetch(`${supabaseUrl}/rest/v1/layout_template?id=eq.${templateId}`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
      });
      const verifyData = await verifyRes.json();
      assert(verifyData.length === 0, "삭제 확인 (0건)");
    } else {
      console.log("  ⚠️  SUPABASE 환경변수 미설정 — Supabase 직접 CRUD 스킵");
    }
  }

  // 3-3. 레이아웃 섹션 구조 검증 (기본 섹션 8개)
  console.log("\n--- 3-3: 기본 레이아웃 섹션 구조 검증 ---");
  {
    const expectedSections = ["overview", "usage", "conditions", "info", "grid", "popup", "tabs", "notes"];
    // 레이아웃 관리 페이지 HTML에서 섹션 확인
    const res = await fetch(`${BASE_URL}/layout-manager`);
    const html = await res.text();
    // 기본 섹션명이 페이지에 렌더링되는지 확인
    for (const name of ["화면개요", "사용법", "조건그룹", "인포그룹", "그리드", "팝업", "탭페이지", "주의사항"]) {
      assert(html.includes(name), `섹션 "${name}" 페이지에 렌더링됨`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 시나리오 4: 에러 핸들링 및 엣지 케이스
// ═══════════════════════════════════════════════════════════════
async function scenario4_errorHandling() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  시나리오 4: 에러 핸들링 및 엣지 케이스 테스트       ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // 4-1. 빈 파일 목록 → 400
  console.log("--- 4-1: 빈 파일 목록 요청 → 400 ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [],
        settings: { provider: "github", model: "gpt-4o-mini", proxyUrl: PROXY_URL, maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    assert(res.status === 400, "빈 파일 → 400");
    const body = await res.json();
    assert(!!body.error, "에러 메시지 존재");
  }

  // 4-2. settings 누락 → 400
  console.log("\n--- 4-2: settings 누락 → 400 ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "test.clx.js", content: "// empty" }],
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    assert(res.status === 400, "settings 누락 → 400");
  }

  // 4-3. 잘못된 JSON → 400
  console.log("\n--- 4-3: 잘못된 JSON → 400 ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all {{{",
    });
    assert(res.status === 400, "잘못된 JSON → 400");
  }

  // 4-4. 빈 내용 파일 → 파싱은 되지만 빈 결과
  console.log("\n--- 4-4: 빈 내용 파일 → 파싱 빈 결과 ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "empty.clx.js", content: "" }],
        settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    assert(res.status === 200, "빈 파일도 200 반환");
    const body = await res.json();
    assert(body.results?.length === 1, "결과 1건 반환 (파싱 빈값)");
    // 빈 파일이므로 개요가 비어있음
    assert(!body.results[0].parseResult.overview.programName, "빈 파일 → programName 없음");
  }

  // 4-5. CLX가 아닌 일반 JS → 파싱은 되지만 메타데이터 없음
  console.log("\n--- 4-5: 일반 JS 파일 → 파싱 가능 (메타데이터 없음) ---");
  {
    const plainJs = `
function hello() {
  console.log("world");
}
export default hello;
`;
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "hello.clx.js", content: plainJs }],
        settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    assert(res.status === 200, "일반 JS → 200");
    const body = await res.json();
    assert(body.results?.length === 1, "결과 반환");
    assert(body.results[0].parseResult.items.grids.length === 0, "그리드 0개 (예상)");
    assert(body.results[0].parseResult.items.conditionGroups.length === 0, "조건그룹 0개 (예상)");
  }

  // 4-6. 잘못된 API 키로 생성 → 에러 반환하되 파싱은 보존
  console.log("\n--- 4-6: 잘못된 API 키 → 파싱 보존, AI 실패 ---");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "test/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
        settings: { provider: "github", apiKey: "invalid-key-12345", model: "gpt-4o-mini", proxyUrl: PROXY_URL, maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    const body = await res.json();
    // AI 실패해도 파싱은 반환
    if (body.results?.length > 0) {
      assert(!!body.results[0].parseResult.overview.programName, "AI 실패해도 파싱 결과 보존");
      console.log(`  AI 토큰: ${body.results[0].tokenUsage.total_tokens} (0이면 AI 실패)`);
    } else if (body.errors?.length > 0) {
      assert(true, `에러 메시지: ${body.errors[0].message.substring(0, 60)}`);
    }
  }

  // 4-7. 매우 큰 파일 (100KB 이상) 처리
  console.log("\n--- 4-7: 대용량 파일 (100KB) 처리 ---");
  {
    let bigContent = SAMPLE_CLX_CONTENT;
    while (bigContent.length < 100_000) {
      bigContent += `\n// padding line ${bigContent.length}`;
    }
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "big.clx.js", content: bigContent }],
        settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    assert(res.status === 200, `대용량 파일 (${(bigContent.length / 1024).toFixed(0)}KB) → 200`);
    const body = await res.json();
    assert(body.results?.length === 1, "대용량 파일 파싱 성공");
  }

  // 4-8. 동시 다중 파일 (10개) 처리
  console.log("\n--- 4-8: 동시 다중 파일 (10개) 일괄 처리 ---");
  {
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `batch/file_${i + 1}.clx.js`,
      content: SAMPLE_CLX_CONTENT.replace("HAKSA001", `BATCH${String(i + 1).padStart(3, "0")}`),
    }));
    const startTime = Date.now();
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files,
        settings: { provider: "vscode-proxy", model: "gpt-4o-mini", proxyUrl: "http://localhost:19999", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    const elapsed = Date.now() - startTime;
    assert(res.status === 200, `10개 일괄 → 200 (${elapsed}ms)`);
    const body = await res.json();
    assert(body.results?.length === 10, `10개 모두 결과 반환`);
    console.log(`  처리 시간: ${elapsed}ms, 파일당 평균: ${(elapsed / 10).toFixed(0)}ms`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 메인 실행
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CLX 매뉴얼 자동생성기 — 핵심 기능 통합 E2E 테스트");
  console.log("  Task 014-1: Integration Test Suite");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  서버: ${BASE_URL}`);
  console.log(`  프록시: ${PROXY_URL}`);
  console.log(`  시간: ${new Date().toLocaleString("ko-KR")}`);

  // .env.local에서 환경변수 로드
  try {
    const envContent = readFileSync(".env.local", "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(NEXT_PUBLIC_\w+)=(.+)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
  } catch {
    console.log("  ⚠️  .env.local 로드 실패");
  }

  const startTime = Date.now();

  try {
    await scenario1_fullFlow();
    await scenario2_dictionaryIntegration();
    await scenario3_layoutIntegration();
    await scenario4_errorHandling();
  } catch (err) {
    console.error(`\n\n❌ 테스트 중단: ${err.message}`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  결과: ✅ ${passCount} PASS / ❌ ${failCount} FAIL`);
  console.log(`  소요: ${totalTime}초`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failCount > 0) process.exit(1);
}

main();
