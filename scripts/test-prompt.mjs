/**
 * UX 라이터 프롬프트 효과 검증
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("env 미설정"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const SAMPLE_DIR = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\screg\\usc07";

const files = readdirSync(SAMPLE_DIR).filter(f=>f.endsWith(".clx.js"));
const CLX_PATH = `univ/screg/usc07/${files[0]}`;
const CLX_CONTENT = readFileSync(join(SAMPLE_DIR, files[0]), "utf-8");
console.log(`파일: ${files[0]}`);

await supabase.from("dictionary").delete().eq("source","ai");
console.log("기존 AI 사전 초기화");

const res = await fetch("http://localhost:3000/api/generate", {
  method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({files:[{path:CLX_PATH,content:CLX_CONTENT}],settings:{provider:"vscode-proxy",model:"gpt-4o-mini",proxyUrl:"http://localhost:3100",maxTokens:4096,temperature:0.3},useDictionary:true,outputFormats:["html"]})
});
const body = await res.json();
const r = body.results?.[0];
if (!r) { console.error("API 실패:", JSON.stringify(body).substring(0,200)); process.exit(1); }

for (const grid of r.parseResult.items.grids) {
  const w = grid.columns.filter(c=>c.description).length;
  console.log(`\n[그리드] ${grid.title} (${w}/${grid.columns.length})`);
  grid.columns.slice(0,4).forEach(c=>console.log(`  ${c.headerText}: ${c.description||"(없음)"}`));
}
for (const grp of r.parseResult.items.conditionGroups) {
  const w = grp.controls.filter(c=>c.description).length;
  console.log(`\n[${grp.groupType}] (${w}/${grp.controls.length})`);
  grp.controls.slice(0,4).forEach(c=>console.log(`  ${c.labelText}: ${c.description||"(없음)"}`));
}

await new Promise(r=>setTimeout(r,2000));
const {count} = await supabase.from("dictionary").select("*",{count:"exact",head:true}).eq("source","ai");
console.log(`\nSupabase 저장: ${count}건`);
