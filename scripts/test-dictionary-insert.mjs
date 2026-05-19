/**
 * 새 UX 라이터 프롬프트 효과 검증
 * 그리드/조건/인포 항목 설명 품질 확인
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ .env.local 환경변수 미설정");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const SAMPLE_DIR = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\screg\\usc07";

let CLX_CONTENT, CLX_PATH;
try {
  const files = readdirSync(SAMPLE_DIR).filter((f) => f.endsWith(".clx.js"));
  CLX_PATH = `univ/screg/usc07/${files[0]}`;
  CLX_CONTENT = readFileSync(join(SAMPLE_DIR, files[0]), "utf-8");
  console.log(`파일 로드: ${files[0]} (${(CLX_CONTENT.length / 1024).toFixed(1)}KB)`);
} catch {
  console.error("❌ 실제 CLX 파일 없음");
  process.exit(1);
}

async function run() {
  // 기존 AI 생성 데이터 초기화
  await supabase.from("dictionary").delete().eq("source", "ai");
  console.log("🗑️  기존 AI 단어사전 초기화");

  // 매뉴얼 생성 API 호출
  console.log("\n🚀 매뉴얼 생성 중 (새 UX 라이터 프롬프트)...");
  let result;
  try {
    const res = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: CLX_PATH, content: CLX_CONTENT }],
        settings: {
          provider: "vscode-proxy",
          model: "gpt-4o-mini",
          proxyUrl: "http://localhost:3100",
          maxTokens: 4096,
          temperature: 0.3,
        },
        useDictionary: true,
        outputFormats: ["html"],
      }),
    });
    const body = await res.json();
    result = body.results?.[0];
    if (!result) {
      console.error("❌ API 응답 오류:", JSON.stringify(body).substring(0, 300));
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ API 호출 실패:", e.message);
    process.exit(1);
  }

  // 그리드 항목 설명 출력
  for (const grid of result.parseResult.items.grids) {
    const withDesc = grid.columns.filter((c) => c.description);
    console.log(`\n=== 그리드: ${grid.title} (${withDesc.length}/${grid.columns.length}) ===`);
    grid.columns.slice(0, 5).forEach((c) => {
      console.log(`  [${c.headerText}] → ${c.description || "(미생성)"}`);
    });
  }

  // 조건/인포 항목 설명 출력
  for (const grp of result.parseResult.items.conditionGroups) {
    const withDesc = grp.controls.filter((c) => c.description);
    console.log(`\n=== ${grp.groupType}: (${withDesc.length}/${grp.controls.length}) ===`);
    grp.controls.slice(0, 5).forEach((c) => {
      console.log(`  [${c.labelText}] → ${c.description || "(미생성)"}`);
    });
  }

  // Supabase 저장 확인
  await new Promise((r) => setTimeout(r, 2000));
  const { count } = await supabase.from("dictionary").select("*", { count: "exact", head: true }).eq("source", "ai");
  console.log(`\n📊 Supabase dictionary에 저장된 AI 항목: ${count}건`);
}

run().catch((e) => { console.error(e); process.exit(1); });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ .env.local 환경변수 미설정");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const SAMPLE_DIR = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\screg\\usc07";

let CLX_CONTENT, CLX_PATH;
try {
  const files = readdirSync(SAMPLE_DIR).filter((f) => f.endsWith(".clx.js"));
  CLX_PATH = `univ/screg/usc07/${files[0]}`;
  CLX_CONTENT = readFileSync(join(SAMPLE_DIR, files[0]), "utf-8");
  console.log(`파일 로드: ${files[0]} (${(CLX_CONTENT.length / 1024).toFixed(1)}KB)`);
} catch {
  console.error("❌ 실제 CLX 파일 없음");
  process.exit(1);
}

async function run() {
  // 1. 생성 전 dictionary 건수
  const { count: before } = await supabase.from("dictionary").select("*", { count: "exact", head: true });
  console.log(`\n📊 생성 전 dictionary 건수: ${before}`);

  // 2. 매뉴얼 생성 API 호출 (useDictionary=true)
  console.log("\n🚀 매뉴얼 생성 중 (useDictionary=true)...");
  let result;
  try {
    const res = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ path: CLX_PATH, content: CLX_CONTENT }],
        settings: {
          provider: "vscode-proxy",
          model: "gpt-4o-mini",
          proxyUrl: "http://localhost:3100",
          maxTokens: 4096,
          temperature: 0.3,
        },
        useDictionary: true,
        outputFormats: ["html"],
      }),
    });
    const body = await res.json();
    result = body.results?.[0];
    if (!result) {
      console.error("❌ API 응답 오류:", JSON.stringify(body).substring(0, 200));
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ API 호출 실패:", e.message);
    process.exit(1);
  }

  // 3. 파싱 결과 확인
  const gridCols = result.parseResult.items.grids[0]?.columns ?? [];
  const gridWithDesc = gridCols.filter((c) => c.description);
  console.log(`\n✅ 그리드 컬럼 설명: ${gridWithDesc.length}/${gridCols.length}`);

  const condCtrls = result.parseResult.items.conditionGroups[0]?.controls ?? [];
  const condWithDesc = condCtrls.filter((c) => c.description);
  console.log(`✅ 조건 항목 설명: ${condWithDesc.length}/${condCtrls.length}`);

  // 4. 비동기 INSERT 완료 대기
  console.log("\n⏳ Supabase INSERT 완료 대기 (3초)...");
  await new Promise((r) => setTimeout(r, 3000));

  // 5. dictionary 건수 재확인
  const { count: after } = await supabase.from("dictionary").select("*", { count: "exact", head: true });
  console.log(`\n📊 생성 후 dictionary 건수: ${after}`);
  console.log(`📈 신규 INSERT 건수: ${after - before}`);

  if (after > before) {
    const { data } = await supabase
      .from("dictionary")
      .select("term, description, source, category")
      .order("created_at", { ascending: false })
      .limit(10);
    console.log("\n🗂️  최근 저장된 항목:");
    for (const row of data ?? []) {
      console.log(`  [${row.source}/${row.category}] ${row.term}: ${row.description?.substring(0, 60)}`);
    }
    console.log("\n✅ PASS: Supabase dictionary 자동 INSERT 정상 동작");
  } else {
    console.log("\n⚠️  dictionary 건수 변화 없음");
    console.log("   - AI 호출 실패 가능성: VS Code 프록시(3100) 미실행?");
    console.log("   - 파싱된 그리드/조건 항목이 없는 경우");
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
