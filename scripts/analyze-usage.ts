const { analyzeFile } = require('./src/lib/parser');
const fs = require('fs');
const content = fs.readFileSync('sample/ule_3040101_u.clx.js', 'utf-8');
const result = analyzeFile('sample/ule_3040101_u.clx.js', content);
const mtb = result.usage.menuTitleBar;

console.log('=== 제공 기능 ===');
const feats = [];
if (mtb.hasInquiry) feats.push('조회');
if (mtb.hasNew) feats.push('신규');
if (mtb.hasSave) feats.push('저장');
if (mtb.hasDelete) feats.push('삭제');
console.log(feats.join(', '));

console.log('\n=== CRUD 비즈니스 로직 (MenuTitleBar) ===');
if (mtb.operations) {
  for (const op of mtb.operations) {
    console.log('■ ' + op.operation);
    if (op.preconditions.length) op.preconditions.forEach((p: string) => console.log('  · 사전조건: ' + p));
    if (op.requiredFields?.length) console.log('  · 필수 입력값: ' + op.requiredFields.join(', '));
    if (op.uniqueKeys?.length) console.log('  · 중복 불가: ' + op.uniqueKeys.join(' + '));
    if (op.validations.length) op.validations.forEach((v: string) => console.log('  · 검증: ' + v));
  }
}

console.log('\n=== 그리드 타이틀바 ===');
for (const tb of result.usage.titleBars) {
  console.log('타이틀: [' + tb.title + '] 저장:' + tb.hasSave + ' 삭제:' + tb.hasDelete + ' 신규:' + tb.hasNew);
  if (tb.operations) {
    for (const op of tb.operations) {
      console.log('  ■ ' + op.operation);
      op.preconditions.forEach((p: string) => console.log('    · 사전조건: ' + p));
      if (op.requiredFields?.length) console.log('    · 필수 입력값: ' + op.requiredFields.join(', '));
      if (op.uniqueKeys?.length) console.log('    · 중복 불가: ' + op.uniqueKeys.join(' + '));
      op.validations.forEach((v: string) => console.log('    · 검증: ' + v));
    }
  }
}

console.log('\n=== 주의사항(workHints) ===');
if (result.workHints?.caution.length) result.workHints.caution.forEach((c: string) => console.log('- ' + c));
