/**
 * 테스트: 단어사전 INSERT 누락 진단
 * 샘플 파일을 파싱하여 조회조건/처리조건/그리드/인포 항목을 확인하고
 * 어떤 항목이 INSERT 대상이 되는지 추적
 */
import { readFileSync } from "fs";

const BASE_URL = "http://localhost:3000";
const SAMPLE_PATH = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\univ\\lessn\\ule03\\ule_3040303_u.clx.js";

const content = readFileSync(SAMPLE_PATH, "utf-8");
const fileName = "ule_3040303_u.clx.js";

console.log(`\n=== 단어사전 INSERT 누락 진단 ===`);
console.log(`파일: ${fileName} (${(content.length / 1024).toFixed(1)}KB)\n`);

// Step 1: 파싱만 테스트 (AI 없이)
async function testParseOnly() {
  console.log("--- Step 1: 파싱 결과 확인 (AI 미사용) ---");
  
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ path: `univ/lessn/ule03/${fileName}`, content }],
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

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    console.log("ERROR: 파싱 결과 없음", data);
    return null;
  }

  const result = data.results[0].parseResult;
  
  console.log("\n[조건그룹]");
  let condTerms = [];
  for (const g of result.items.conditionGroups) {
    console.log(`  ${g.groupType} (${g.controls.length}개):`);
    for (const c of g.controls) {
      console.log(`    - "${c.labelText}" | desc: ${c.description ? '✓' : '✗'}`);
      if (c.labelText) condTerms.push(c.labelText);
    }
  }
  
  console.log("\n[인포영역]");
  let infoTerms = [];
  for (const g of result.items.infoGroups) {
    console.log(`  ${g.groupType} (${g.controls.length}개):`);
    for (const c of g.controls) {
      console.log(`    - "${c.labelText}" | desc: ${c.description ? '✓' : '✗'}`);
      if (c.labelText) infoTerms.push(c.labelText);
    }
  }
  
  console.log("\n[그리드]");
  let gridTerms = [];
  for (const g of result.items.grids) {
    console.log(`  ${g.gridId} "${g.title}" (${g.columns.length}개 컬럼, skipAi: ${g.skipAiDescriptions || false}):`);
    for (const c of g.columns) {
      console.log(`    - "${c.headerText}" | desc: ${c.description ? '✓' : '✗'} ${c.description || ''}`);
      if (c.headerText && !c.description) gridTerms.push(c.headerText);
    }
  }
  
  const totalNeedDesc = condTerms.length + infoTerms.length + gridTerms.length;
  console.log("\n--- 요약 ---");
  console.log(`  조건그룹 항목: ${condTerms.length}개`);
  console.log(`  인포영역 항목: ${infoTerms.length}개`);
  console.log(`  그리드 (desc 없는 것): ${gridTerms.length}개`);
  console.log(`  전체 AI/INSERT 대상: ${totalNeedDesc}개`);
  
  return { condTerms, infoTerms, gridTerms };
}

const terms = await testParseOnly();
