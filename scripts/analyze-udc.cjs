/**
 * UDC 분석 스크립트 - 누락된 UDC의 exports 함수 전체 추출
 */
const fs = require('fs');

const content = fs.readFileSync(
  'D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\cpr-lib\\udc.js',
  'utf-8'
);

const existing = new Set([
  'AacAcntgComnt','AacCnptComnt','AacGeoraecheoComp','AasPummokComp',
  'AcoGridMultiControl','AfcHosilComp','AfcRmnmComnt','AhmBojikCdFindComp',
  'AhmBuseoComp','AhmGyojikwonComp','AhmJikjongComp','PatisCombo',
  'UcoSrchComnt','UcoStdntComnt','UcoYrSmstrCombo','UleSbjctComnt',
  'UleSubjectComp','UscSearchCombo','UscStudentSearchComp','UscYrSctmCombo','UcoBtchList'
]);

const sections = content.split(/\/\/\/ start - /);
sections.shift();

for (const section of sections) {
  const qualifiedName = section.split('\n')[0].trim();
  const shortName = qualifiedName.split('.').pop();
  if (existing.has(shortName)) continue;
  
  // All exports
  const exps = [...section.matchAll(/exports\.(\w+)\s*=/g)].map(m=>m[1]);
  const labelFns = exps.filter(fn => /label|text|title|width/i.test(fn) || fn === 'setLabel' || fn === 'initLabel');
  
  // defaultLabels from T_S_ or T_ outputs
  const defaultLabels = {};
  const matches = [...section.matchAll(/app\.lookup\(["']([T][_][A-Z_0-9]+)["']\)[^;]*?\.(?:setValue|setText)\(["']([^"']{1,25})["']\)/g)];
  matches.forEach(m => { defaultLabels[m[1]] = m[2]; });
  
  if (labelFns.length > 0 || Object.keys(defaultLabels).length > 0) {
    console.log(`${shortName}: labelFns=${JSON.stringify(labelFns)}, defaults=${JSON.stringify(defaultLabels)}`);
  }
}
