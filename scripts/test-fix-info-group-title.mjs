/**
 * 수정된 infoGroupParser.ts의 parseInfoGroups 함수로
 * aac_4040106_u.clx.js 파일의 INFOGROUP01 타이틀 취득 확인
 */
import { readFileSync } from "node:fs";

// ts-node 없이 CommonJS로 변환된 파일이 있는지 확인
// 대신 정규식을 직접 재현하여 800자 범위로 테스트
const content = readFileSync("sample/aac_4040106_u.clx.js", "utf8");

console.log("=== CT_INFOTITLE{N} 탐색 (800자 범위) ===");
const titleDeclRe = /var\s+(\w+)\s*=\s*(?:linker\.\w+\s*=\s*)?new\s+udc\.common\.PatisTitleBar\("CT_[^"]*INFOTITLE(\d+)"\)/g;
let tm;
let count = 0;
while ((tm = titleDeclRe.exec(content)) !== null) {
  const tvName = tm[1];
  const tNum = tm[2];
  // 수정된 800자 범위 적용
  const after = content.slice(tm.index, tm.index + 800);
  const titleRe = new RegExp(`${tvName}\\.title\\s*=\\s*"([^"]+)"`);
  const titleM = titleRe.exec(after);
  if (titleM) {
    console.log(`CT_INFOTITLE${tNum}: title = "${titleM[1]}" ✅ (800자 범위 내 발견)`);
  } else {
    console.log(`CT_INFOTITLE${tNum}: title NOT FOUND (800자 범위 내 없음)`);
  }
  count++;
}
console.log(`Total CT_INFOTITLE found: ${count}`);
