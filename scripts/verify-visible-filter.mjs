import { analyzeFile } from '../src/lib/parser/index.ts';
import { readFileSync } from 'fs';

const content = readFileSync('sample/abg_4030201_u.clx.js', 'utf-8');
const result = analyzeFile('sample/abg_4030201_u.clx.js', content);

console.log('=== CONDITION GROUPS ===');
for (const g of result.items.conditionGroups) {
  console.log(`${g.groupId} | ${g.groupType}`);
  for (const c of g.controls) {
    console.log(`  ${c.controlId} | ${c.labelText} | ${c.controlType}`);
  }
}

console.log('\n=== USED UDCs ===');
for (const u of result.usedUdcs) {
  console.log(`${u.shortName} | ${u.description}`);
}