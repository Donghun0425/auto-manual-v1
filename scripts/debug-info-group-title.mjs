/**
 * INFOGROUP 타이틀 취득 디버깅 스크립트
 * aac_4040106_u.clx.js 파일에서 CT_INFOTITLE01과 INFOGROUP01 매핑을 확인
 */
import { readFileSync } from "node:fs";

const content = readFileSync("sample/aac_4040106_u.clx.js", "utf8");

console.log("=== CT_INFOTITLE{N} 탐색 ===");
const titleDeclRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+udc\.common\.PatisTitleBar\("CT_[^"]*INFOTITLE(\d+)"\)/g;
let tm;
let count = 0;
while ((tm = titleDeclRe.exec(content)) !== null) {
  const tvName = tm[1];
  const tNum = tm[2];
  console.log(`Found CT_INFOTITLE${tNum} at index ${tm.index}, var=${tvName}`);

  // 선언 이후 400자 이내에서 varName.title = "..." 탐색
  const after = content.slice(tm.index, tm.index + 400);
  const titleRe = new RegExp(`${tvName}\\.title\\s*=\\s*"([^"]+)"`);
  const titleM = titleRe.exec(after);
  if (titleM) {
    console.log(`  -> title found (within 400 chars): "${titleM[1]}"`);
  } else {
    console.log(`  -> title NOT found within 400 chars`);
    // 실제 title까지의 거리 측정
    const actualTitleRe = new RegExp(`${tvName}\\.title\\s*=\\s*"([^"]+)"`);
    const actualTitleM = actualTitleRe.exec(content.slice(tm.index));
    if (actualTitleM) {
      console.log(`  -> Actual title: "${actualTitleM[1]}" (distance: ${actualTitleM.index} chars)`);
    } else {
      console.log(`  -> No .title assignment found anywhere near this var`);
    }
  }
  count++;
}
console.log(`Total CT_INFOTITLE found: ${count}`);

console.log("\n=== INFOGROUP{N} Container 탐색 ===");
const groupRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+cpr\.controls\.Container\("(INFOGROUP(\d+))"\)/g;
let gm;
while ((gm = groupRe.exec(content)) !== null) {
  const varName = gm[1];
  const groupId = gm[2];
  const afterDecl = content.slice(gm.index, gm.index + 300);
  const hasClFormGroup = afterDecl.includes("cl-form-group");
  console.log(`Found ${groupId} at index ${gm.index}, var=${varName}, cl-form-group=${hasClFormGroup}`);
}

console.log("\n=== PatisMenuTitleBar.initBindObject 탐색 ===");
const bindRe = /PatisMenuTitleBar\s*\.\s*initBindObject\s*\(\s*app\.lookup\("([^"]+)"\)\s*\)/g;
let bm;
while ((bm = bindRe.exec(content)) !== null) {
  console.log(`Found initBindObject at index ${bm.index}, target=${bm[1]}`);
}

console.log("\n=== DataColumn 바인딩 탐색 (toDataColumn) ===");
const dcRe = /\.bind\("value"\)\.toDataColumn\("([^"]+)"\)/g;
let dcm;
const dataColumns = new Set();
while ((dcm = dcRe.exec(content)) !== null) {
  dataColumns.add(dcm[1]);
}
console.log(`Data columns found (${dataColumns.size}):`, [...dataColumns].slice(0, 20).join(", "));

// INFOGROUP01 body 영역 내의 toDataColumn만 확인
const infoGroupStart = content.indexOf('new cpr.controls.Container("INFOGROUP01")');
if (infoGroupStart >= 0) {
  // body 추출
  const funcMarker = "(function(container){";
  const bodyStart = content.indexOf(funcMarker, infoGroupStart);
  if (bodyStart >= 0) {
    let depth = 0;
    let bodyEnd = bodyStart;
    for (let i = bodyStart; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) { bodyEnd = i; break; }
      }
    }
    const body = content.slice(bodyStart + funcMarker.length, bodyEnd);
    const bodyDcRe = /\.bind\("value"\)\.toDataColumn\("([^"]+)"\)/g;
    let bdcm;
    const bodyCols = [];
    while ((bdcm = bodyDcRe.exec(body)) !== null) {
      bodyCols.push(bdcm[1]);
    }
    console.log(`\nINFOGROUP01 body toDataColumn columns:`, bodyCols.join(", ") || "(none)");
  }
}
