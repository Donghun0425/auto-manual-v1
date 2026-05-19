/**
 * E2E 테스트: 파서 결과 상세 검증
 * API를 통해 파싱 결과가 올바른지 확인
 */

// 실제 파서 패턴에 맞는 CLX 샘플
const SAMPLE_CLX = `
// [시스템명] 학사관리시스템
// [부시스템] 수강관리
// [프로그램] 수강신청 관리
// [설명] 학생 수강신청 내역을 조회하고 관리하는 화면
// [작성자명] 홍길동
// [작성일자] 2024.01.15

function Form_inqAction(e) {
  var grid1 = app.lookup("DG_GRID1");
  grid1.setDataProvider(dataSet1);
}

function Form_newAction(e) {
  app.lookup("DG_GRID1").insertRow(0);
}

function Form_saveAction(e) {
  PatisUtils.save(app, dataSet1);
}

function Form_delAction(e) {
  PatisUtils.deleteRow(app, "DG_GRID1");
}

function Form_ext1Click(e) {
  app.lookup("DG_GRID1").exportAsExcel();
}

// ext button label
var patisMenuTitleBar = app.lookup("patisMenuTitleBar");
patisMenuTitleBar.ext1.value = "엑셀다운로드";

// required fields
PatisUtils.setAppProperty(app, app.lookup("DG_GRID1"), "requiredColumn", new Array("STDT_NO","SUBJ_CD"));
PatisUtils.setAppProperty(app, app.lookup("DG_GRID1"), "requiredText", new Array("학번","과목코드"));

// validations
function onBeforeSave(e) {
  if (!app.lookup("txtDept").getValue()) {
    alert("학과를 선택하세요.");
    return false;
  }
  if (Number(app.lookup("txtCredit").getValue()) > 21) {
    alert("최대 신청 학점을 초과하였습니다.");
    return false;
  }
}
`;

const BASE_URL = "http://localhost:3000";

async function testParserDetails() {
  console.log("\n=== 파서 상세 검증 테스트 ===\n");

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: "수강관리/HAKSA001.clx.js", content: SAMPLE_CLX }],
      settings: {
        provider: "vscode-proxy",
        model: "gpt-4o-mini",
        proxyUrl: "http://localhost:19999",
        maxTokens: 4096,
        temperature: 0.3,
      },
      useDictionary: false,
      outputFormats: ["html"],
    }),
  });

  const body = await res.json();
  console.log(`HTTP Status: ${res.status}`);
  console.log(`Results: ${body.results?.length ?? 0}, Errors: ${body.errors?.length ?? 0}`);

  if (body.results?.length > 0) {
    const r = body.results[0];
    const p = r.parseResult;
    
    console.log("\n--- 파싱 결과 검증 ---");
    console.log(`파일명: ${r.fileName}`);
    console.log(`\n[개요]`);
    console.log(`  시스템: ${p.overview.systemName}`);
    console.log(`  부시스템: ${p.overview.subSystem}`);
    console.log(`  프로그램: ${p.overview.programName}`);
    console.log(`  작성자: ${p.overview.author}`);

    console.log(`\n[CRUD]`);
    console.log(`  조회: ${p.usage.menuTitleBar.hasInquiry}`);
    console.log(`  신규: ${p.usage.menuTitleBar.hasNew}`);
    console.log(`  저장: ${p.usage.menuTitleBar.hasSave}`);
    console.log(`  삭제: ${p.usage.menuTitleBar.hasDelete}`);
    console.log(`  추가버튼: ${p.usage.menuTitleBar.extButtons?.length ?? 0}개`);
    if (p.usage.menuTitleBar.extButtons?.length > 0) {
      console.log(`    [0] ${p.usage.menuTitleBar.extButtons[0].name}`);
    }

    console.log(`\n[검증]`);
    console.log(`  필수값: ${p.notes.requiredFields?.length ?? 0}건`);
    if (p.notes.requiredFields?.[0]) {
      console.log(`    대상: ${p.notes.requiredFields[0].targetId}`);
      console.log(`    컬럼: ${p.notes.requiredFields[0].columns?.join(", ")}`);
      console.log(`    텍스트: ${p.notes.requiredFields[0].texts?.join(", ")}`);
    }
    console.log(`  Alert: ${p.notes.validations?.length ?? 0}건`);
    if (p.notes.validations?.length > 0) {
      p.notes.validations.forEach((v, i) => console.log(`    [${i}] ${v.message}`));
    }

    // Assertions
    let pass = true;
    const assert = (cond, msg) => { if (!cond) { console.log(`  ❌ ${msg}`); pass = false; } };
    
    assert(p.overview.systemName === "학사관리시스템", "systemName 불일치");
    assert(p.overview.programName === "수강신청 관리", "programName 불일치");
    assert(p.overview.author === "홍길동", "author 불일치");
    assert(p.usage.menuTitleBar.hasInquiry === true, "hasInquiry should be true");
    assert(p.usage.menuTitleBar.hasNew === true, "hasNew should be true");
    assert(p.usage.menuTitleBar.hasSave === true, "hasSave should be true");
    assert(p.usage.menuTitleBar.hasDelete === true, "hasDelete should be true");
    assert(p.usage.menuTitleBar.extButtons?.length >= 1, "extButtons >= 1");
    assert(p.notes.requiredFields?.length === 1, "requiredFields should have 1 entry");
    assert(p.notes.requiredFields?.[0]?.targetId === "DG_GRID1", "requiredField targetId");
    assert(p.notes.validations?.length === 2, "validations should have 2 entries");

    if (pass) {
      console.log("\n✅ 파싱 결과 검증 ALL PASS");
    } else {
      process.exit(1);
    }
  } else {
    console.log("❌ 결과가 없음 (에러만 존재)");
    if (body.errors?.length > 0) {
      console.log(`  Error: ${body.errors[0].message}`);
    }
    process.exit(1);
  }

  console.log("\n=== 테스트 완료 ===");
}

testParserDetails().catch((err) => {
  console.error("❌ FAILED:", err.message);
  process.exit(1);
});
