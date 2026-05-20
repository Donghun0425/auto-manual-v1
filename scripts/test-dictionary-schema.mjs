/**
 * dictionary 테이블 스키마 변경 검증 (term → PK, id 컬럼 제거)
 * 실행: node --env-file=.env.local scripts/test-dictionary-schema.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ 환경변수 미설정: .env.local 파일을 확인하세요.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TEST_TERM = "__test_term__";
let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}
function fail(label, detail) {
  console.error(`  ❌ ${label}${detail ? `: ${detail}` : ""}`);
  failed++;
}

// ── 1. id 컬럼이 없는지 확인 ─────────────────────────────────
console.log("\n[1] 컬럼 구조 확인");
{
  const { data, error } = await supabase
    .from("dictionary")
    .select("*")
    .limit(1);

  if (error) {
    fail("dictionary 테이블 접근", error.message);
  } else {
    const cols = data.length > 0 ? Object.keys(data[0]) : null;
    if (cols) {
      cols.includes("id")
        ? fail("id 컬럼 제거 확인", "id 컬럼이 아직 존재합니다")
        : ok("id 컬럼 없음");
      cols.includes("term")
        ? ok("term 컬럼 존재")
        : fail("term 컬럼 존재 확인");
    } else {
      ok("테이블 접근 성공 (행 없음, 컬럼 구조는 INSERT 후 확인)");
    }
  }
}

// ── 2. INSERT (term PK 기준) ──────────────────────────────────
console.log("\n[2] INSERT 테스트");

// 테스트 전 잔여 데이터 정리
await supabase.from("dictionary").delete().eq("term", TEST_TERM);

const insertPayload = {
  term: TEST_TERM,
  category: "기타",
  description: "테스트용 임시 항목",
  source: "manual",
};

{
  const { data, error } = await supabase
    .from("dictionary")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    fail("INSERT 성공", error.message);
  } else {
    ok("INSERT 성공");
    "id" in data
      ? fail("응답에 id 컬럼 없음 확인", "id 필드가 반환됨")
      : ok("응답에 id 컬럼 없음");
    data.term === TEST_TERM
      ? ok(`term 값 일치: "${data.term}"`)
      : fail("term 값 일치", `기대값 ${TEST_TERM}, 실제값 ${data.term}`);
  }
}

// ── 3. 중복 term INSERT → PK 오류 확인 ───────────────────────
console.log("\n[3] 중복 term PK 제약 확인");
{
  const { error } = await supabase
    .from("dictionary")
    .insert(insertPayload);

  if (error && (error.code === "23505" || error.message.includes("duplicate") || error.message.includes("unique"))) {
    ok(`중복 term PK 오류 정상 발생 (code: ${error.code})`);
  } else if (error) {
    fail("중복 PK 오류 예상", `다른 오류: ${error.message}`);
  } else {
    fail("중복 term PK 제약 동작", "중복 INSERT가 허용되었습니다");
  }
}

// ── 4. SELECT by term ─────────────────────────────────────────
console.log("\n[4] SELECT (term 기준 단건 조회)");
{
  const { data, error } = await supabase
    .from("dictionary")
    .select("*")
    .eq("term", TEST_TERM)
    .single();

  if (error) {
    fail("SELECT by term", error.message);
  } else {
    ok("SELECT 성공");
    data.description === "테스트용 임시 항목"
      ? ok("description 값 정확")
      : fail("description 값", data.description);
  }
}

// ── 5. UPDATE by term ─────────────────────────────────────────
console.log("\n[5] UPDATE (term 기준 수정)");
{
  const { data, error } = await supabase
    .from("dictionary")
    .update({ description: "수정된 설명", category: "공통" })
    .eq("term", TEST_TERM)
    .select()
    .single();

  if (error) {
    fail("UPDATE by term", error.message);
  } else {
    ok("UPDATE 성공");
    data.description === "수정된 설명"
      ? ok("수정된 description 반영")
      : fail("description 수정 반영", data.description);
    data.category === "공통"
      ? ok("수정된 category 반영")
      : fail("category 수정 반영", data.category);
  }
}

// ── 6. DELETE by term ─────────────────────────────────────────
console.log("\n[6] DELETE (term 기준 삭제)");
{
  const { error } = await supabase
    .from("dictionary")
    .delete()
    .eq("term", TEST_TERM);

  if (error) {
    fail("DELETE by term", error.message);
  } else {
    // 삭제 후 조회해서 실제로 없는지 확인
    const { data } = await supabase
      .from("dictionary")
      .select("*")
      .eq("term", TEST_TERM)
      .maybeSingle();

    data === null
      ? ok("DELETE 성공, 행 미존재 확인")
      : fail("DELETE 후 행 미존재 확인", "삭제 후에도 행이 남아있음");
  }
}

// ── 결과 ────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(40)}`);
console.log(`결과: ${passed}개 통과 / ${failed}개 실패`);
if (failed === 0) {
  console.log("✅ 모든 테스트 통과 — term PK 스키마 정상 동작");
} else {
  console.error("❌ 일부 테스트 실패 — 위 로그를 확인하세요.");
  process.exit(1);
}
