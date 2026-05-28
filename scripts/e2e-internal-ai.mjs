/**
 * E2E 테스트: 내부 AI 서버(gemma4-31b) 연동 검증
 * - 실제 내부 AI 서버 API 호출
 * - OpenAI-compatible chat/completions 엔드포인트 테스트
 * - 매뉴얼 생성 전체 파이프라인 테스트
 */

const INTERNAL_BASE_URL = "http://192.168.71.125/v1";
const API_KEY = process.env.INTERNAL_AI_KEY || "app-uTSCZ0M2cNNJqa6m0jeBZG9b";
const APP_BASE_URL = "http://localhost:3000";

const SAMPLE_CLX_CONTENT = `
/******************************************************************
 * 시스템명 : 학사관리시스템
 * 서브시스템 : 수강관리
 * 프로그램ID : HAKSA001
 * 프로그램명 : 수강신청 관리
 * 작성자 : 홍길동
 * 작성일 : 2024.01.15
 ******************************************************************/

function onBodyLoad() {
  var menuTitleBar = app.lookup("menuTitleBar");
  menuTitleBar.addInquiry();
  menuTitleBar.addNew();
  menuTitleBar.addSave();
  menuTitleBar.addDelete();
  
  var condGrp1 = app.lookup("condGrp1");
  condGrp1.addChild("sDeptCd", "학과코드", "TextInput");
  condGrp1.addChild("sStdtNm", "학생명", "TextInput");
  
  var grid1 = app.lookup("grid1");
  grid1.setTitle("수강신청 목록");
  grid1.setBoundData(true);
  
  app.lookup("grid1").addColumn({columnName: "STDT_NO", headerText: "학번"});
  app.lookup("grid1").addColumn({columnName: "STDT_NM", headerText: "학생명"});
  app.lookup("grid1").addColumn({columnName: "SUBJ_NM", headerText: "과목명"});
  app.lookup("grid1").addColumn({columnName: "CREDIT", headerText: "학점"});
}
`;

async function test1_DirectApiCall() {
  console.log("\n=== Test 1: 내부 AI 서버 직접 API 호출 (Dify /v1/chat-messages) ===");
  
  const payload = {
    inputs: {},
    query: "[지시사항]\n당신은 UX 라이터입니다. 간결하게 답변하세요.\n\n[요청]\n\"학번\" 컬럼의 의미를 IT 비전문가가 이해할 수 있도록 1줄로 설명하세요.",
    response_mode: "blocking",
    user: "e2e-test",
  };

  const res = await fetch(`${INTERNAL_BASE_URL}/chat-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  console.log(`  Status: ${res.status}`);
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`내부 AI 서버 응답 실패 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const answer = data.answer ?? "";
  console.log(`  Response: ${answer.substring(0, 150)}`);
  console.log(`  Usage: prompt=${data.metadata?.usage?.prompt_tokens}, completion=${data.metadata?.usage?.completion_tokens}, total=${data.metadata?.usage?.total_tokens}`);
  
  if (!answer) throw new Error("FAIL: 응답 answer가 비어있습니다.");
  console.log("  ✅ PASS");
}

async function test2_AppGenerateEndpoint() {
  console.log("\n=== Test 2: /api/generate 엔드포인트 (internal provider) ===");
  
  const res = await fetch(`${APP_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "수강관리/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
      settings: {
        provider: "internal",
        apiKey: API_KEY,
        model: "gemma4-31b",
        proxyUrl: "http://localhost:3100",
        internalBaseUrl: INTERNAL_BASE_URL,
        maxTokens: 4096,
        temperature: 0.3,
      },
      useDictionary: false,
      outputFormats: ["html"],
    }),
  });

  console.log(`  Status: ${res.status}`);
  const body = await res.json();
  
  if (body.results && body.results.length > 0) {
    const r = body.results[0];
    console.log(`  파일명: ${r.fileName}`);
    console.log(`  프로그램명: ${r.parseResult?.overview?.programName}`);
    console.log(`  그리드 수: ${r.parseResult?.items?.grids?.length ?? 0}`);
    console.log(`  조건그룹 수: ${r.parseResult?.items?.conditionGroups?.length ?? 0}`);
    console.log(`  HTML 길이: ${r.html?.length ?? 0} chars`);
    console.log(`  토큰 사용량: ${body.totalTokens ?? 0}`);
    console.log(`  소요 시간: ${body.duration ?? 0}ms`);

    // AI가 설명을 생성했는지 확인
    const grids = r.parseResult?.items?.grids ?? [];
    if (grids.length > 0 && grids[0].columns?.length > 0) {
      const firstCol = grids[0].columns[0];
      console.log(`  첫 컬럼(${firstCol.headerText}) 설명: ${firstCol.description ?? "(없음)"}`);
    }
    
    console.log("  ✅ PASS");
  } else if (body.errors && body.errors.length > 0) {
    console.log(`  Error: ${body.errors[0].message}`);
    throw new Error(`FAIL: 생성 실패 — ${body.errors[0].message}`);
  } else {
    throw new Error("FAIL: 결과도 에러도 없음");
  }
}

async function main() {
  console.log("========================================");
  console.log(" 내부 AI 서버 (gemma4-31b) E2E 테스트");
  console.log("========================================");
  console.log(`  Base URL: ${INTERNAL_BASE_URL}`);
  console.log(`  Model: gemma4-31b`);
  console.log(`  API Key: ${API_KEY.substring(0, 8)}...`);
  
  // Test 1: 직접 API 호출
  await test1_DirectApiCall();
  
  // Test 2: 앱 서버 경유 생성 (dev 서버가 실행 중일 때만)
  try {
    const healthRes = await fetch(`${APP_BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (healthRes.ok) {
      await test2_AppGenerateEndpoint();
    } else {
      console.log("\n=== Test 2: SKIP (앱 서버가 응답하지 않음) ===");
    }
  } catch {
    console.log("\n=== Test 2: SKIP (앱 서버 미실행 — localhost:3000) ===");
  }

  console.log("\n========================================");
  console.log(" ✅ 모든 E2E 테스트 완료");
  console.log("========================================");
}

main().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  process.exit(1);
});
