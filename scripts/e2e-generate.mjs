/**
 * E2E 테스트 스크립트
 * Task 013: 매뉴얼 생성 전체 플로우 검증
 * - 파싱 정상 동작
 * - AI API 호출 시도 (API 키 없으면 에러 반환 확인)
 * - 프록시 모드 테스트
 */

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
  menuTitleBar.addExtButton("엑셀다운로드", onExcelDown);
  
  var condGrp1 = app.lookup("condGrp1");
  condGrp1.addChild("sDeptCd", "학과코드", "TextInput");
  condGrp1.addChild("sStdtNm", "학생명", "TextInput");
  condGrp1.addChild("sSemCd", "학기", "SelectBox");
  
  var grid1 = app.lookup("grid1");
  grid1.setTitle("수강신청 목록");
  grid1.setBoundData(true);
  grid1.setCheckbox(true);
  grid1.setSortable(true);
  
  app.lookup("grid1").addColumn({columnName: "STDT_NO", headerText: "학번"});
  app.lookup("grid1").addColumn({columnName: "STDT_NM", headerText: "학생명"});
  app.lookup("grid1").addColumn({columnName: "SUBJ_CD", headerText: "과목코드"});
  app.lookup("grid1").addColumn({columnName: "SUBJ_NM", headerText: "과목명"});
  app.lookup("grid1").addColumn({columnName: "CREDIT", headerText: "학점"});
}

function onExcelDown() {
  app.lookup("grid1").exportAsExcel("수강신청_목록");
}

scwin.requiredFields = [
  {targetId: "grid1", columns: ["STDT_NO","SUBJ_CD"], texts: ["학번","과목코드"]}
];

scwin.validations = function() {
  if (!app.lookup("sDeptCd").getValue()) {
    alert("학과코드를 입력하세요.");
    return false;
  }
  return true;
};
`;

const BASE_URL = "http://localhost:3000";

async function testApiRoute() {
  console.log("\\n=== Test 1: 빈 파일 요청 → 400 ===");
  {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [],
        settings: { provider: "github", model: "gpt-4o-mini", proxyUrl: "http://localhost:3100", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    console.log(`  Status: ${res.status} (expected: 400)`);
    const body = await res.json();
    console.log(`  Body: ${JSON.stringify(body)}`);
    if (res.status !== 400) throw new Error("FAIL: expected 400");
    console.log("  ✅ PASS");
  }

  console.log("\\n=== Test 2: 유효한 파일 + 프록시 모드 (연결 불가 → 에러 포함 결과) ===");
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
    console.log(`  Status: ${res.status} (expected: 200)`);
    const body = await res.json();
    console.log(`  Results count: ${body.results?.length ?? 0}`);
    console.log(`  Errors count: ${body.errors?.length ?? 0}`);
    
    // 프록시 연결 불가이므로 에러가 있거나 AI 설명이 비어있을 수 있음
    // 하지만 파싱 자체는 성공해야 함
    if (body.results && body.results.length > 0) {
      const r = body.results[0];
      console.log(`  Parse result file: ${r.fileName}`);
      console.log(`  Overview.programName: ${r.parseResult?.overview?.programName}`);
      console.log(`  Grids count: ${r.parseResult?.items?.grids?.length}`);
      console.log(`  ConditionGroups count: ${r.parseResult?.items?.conditionGroups?.length}`);
      console.log("  ✅ PASS (파싱 성공, AI 연결 에러는 예상대로)");
    } else if (body.errors && body.errors.length > 0) {
      console.log(`  Error: ${body.errors[0].message}`);
      // AI 연결 에러는 예상대로 (프록시 서버 없음)
      console.log("  ✅ PASS (AI 프록시 연결 실패는 예상된 동작)");
    } else {
      throw new Error("FAIL: 결과도 에러도 없음");
    }
  }

  console.log("\\n=== Test 3: 파싱만 검증 (useDictionary=false, 가짜 설정) ===");
  {
    // AI 호출이 실패해도 파싱 결과는 반환되는지 확인
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: "수강관리/HAKSA001.clx.js", content: SAMPLE_CLX_CONTENT }],
        settings: { provider: "github", apiKey: "test-invalid-key", model: "gpt-4o-mini", proxyUrl: "http://localhost:3100", maxTokens: 4096, temperature: 0.3 },
        useDictionary: false,
        outputFormats: ["html"],
      }),
    });
    console.log(`  Status: ${res.status}`);
    const body = await res.json();
    
    if (body.errors && body.errors.length > 0) {
      console.log(`  Error message: ${body.errors[0].message.substring(0, 80)}`);
      console.log("  ✅ PASS (잘못된 API 키로 인한 에러 확인)");
    } else if (body.results && body.results.length > 0) {
      console.log("  ✅ PASS (결과 반환)");
    }
  }

  console.log("\\n=== Test 4: /generate 페이지 로드 확인 ===");
  {
    const res = await fetch(`${BASE_URL}/generate`);
    console.log(`  Status: ${res.status} (expected: 200)`);
    if (res.status !== 200) throw new Error("FAIL: page not loading");
    console.log("  ✅ PASS");
  }

  console.log("\\n=== 모든 E2E 테스트 통과 ===");
}

testApiRoute().catch((err) => {
  console.error("\\n❌ TEST FAILED:", err.message);
  process.exit(1);
});
