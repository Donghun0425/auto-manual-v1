// 후처리 4 및 {MSG} 렌더러 로직 단위 테스트
const text = [
  '{B}조회{/B}',
  'Step1. 개설년도를 입력합니다.',
  'Step2. 개설년도를 입력하지 않은 경우 "개설년도를 입력해주시기 바랍니다." 메시지를 확인합니다.',
  'Step3. 시간표 입력기간이 아닌 경우 "시간표 입력기간이 아닙니다." 메시지를 확인합니다.',
  'Step4. 조회 버튼을 클릭합니다.',
  '{B}시간표 - 시간표변경{/B}',
  'Step1. 이미 올바른 형식: 아래와 같은 메시지가 출력됩니다.',
  '{MSG}이미 올바른 메시지{/MSG}',
].join('\n');

// 후처리 4
const result = text.replace(
  /(Step\d+\.[^\n]+?)"([^"\n]+)" 메시지(?:를 확인합니다|가 표시됩니다|가 나타납니다)\./g,
  '$1아래와 같은 메시지가 출력됩니다.\n{MSG}$2{/MSG}'
);

console.log('=== 후처리 4 결과 ===');
console.log(result);

let pass = true;

// 검증 1: 구버전 패턴 사라짐
if (result.includes('메시지를 확인합니다')) {
  console.error('❌ 구버전 패턴이 남아있음');
  pass = false;
} else {
  console.log('✅ 구버전 패턴 완전 제거됨');
}

// 검증 2: {MSG} 태그 개수
const msgCount = [...result.matchAll(/\{MSG\}/g)].length;
if (msgCount === 3) {
  console.log('✅ {MSG} 태그 3개 (기존 1 + 새로 2) 정상 생성');
} else {
  console.error(`❌ {MSG} 태그 수 불일치: ${msgCount}개`);
  pass = false;
}

// 검증 3: HTML 렌더링
console.log('\n=== HTML 렌더링 시뮬레이션 ===');
for (const raw of result.split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  if (/^\{MSG\}.+\{\/MSG\}$/.test(line)) {
    const msgInner = line.replace(/^\{MSG\}/, '').replace(/\{\/MSG\}$/, '').replace(/^"|"$/g, '').trim();
    console.log(`  <p class="msg-box">💬 "${msgInner}"</p>`);
  } else if (/^Step\d+\./i.test(line)) {
    console.log(`  <p class="step">${line}</p>`);
  } else if (/^\{B\}.+\{\/B\}$/.test(line)) {
    const inner = line.replace(/^\{B\}/, '').replace(/\{\/B\}$/, '');
    console.log(`  <span class="bold-tag">${inner}</span>`);
  }
}

// 검증 4: MD 렌더링
console.log('\n=== MD 렌더링 시뮬레이션 ===');
for (const raw of result.split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  if (/^\{MSG\}.+\{\/MSG\}$/.test(line)) {
    const msgInner = line.replace(/^\{MSG\}/, '').replace(/\{\/MSG\}$/, '').replace(/^"|"$/g, '').trim();
    console.log(`> 💬 **"${msgInner}"**`);
  } else if (/^Step\d+\./i.test(line)) {
    console.log(`- ${line}`);
  } else if (/^\{B\}.+\{\/B\}$/.test(line)) {
    const inner = line.replace(/^\{B\}/, '').replace(/\{\/B\}$/, '');
    console.log(`\n**${inner}**\n`);
  }
}

console.log('\n' + (pass ? '✅ 모든 테스트 PASS' : '❌ 일부 테스트 FAIL'));
process.exit(pass ? 0 : 1);
