// Supabase 연결 검증 스크립트
// 실행: node --env-file=.env.local scripts/verify-supabase.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ 환경변수 미설정: .env.local 파일을 확인하세요.");
  process.exit(1);
}

console.log(`🔗 Supabase URL: ${url.replace(/https:\/\/(.{6}).*/, "https://$1...")}`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = ["dictionary", "layout_template", "generation_log"];
let allOk = true;

for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(`❌ ${table}: ${error.message}`);
    allOk = false;
  } else {
    console.log(`✅ ${table}: 정상 (현재 ${count ?? 0}건)`);
  }
}

if (allOk) {
  console.log("\n✅ Task 009 검증 완료: Supabase 연결 및 3개 테이블 정상 확인");
} else {
  console.error("\n❌ 일부 테이블에 문제가 있습니다. SQL 마이그레이션을 재실행하세요.");
  process.exit(1);
}
