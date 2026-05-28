// 후처리 5 (중복 섹션 제거) 단위 테스트
const aiText = [
  '{B}조회{/B}',
  'Step1. 개설년도를 입력합니다.',
  'Step2. 조회 버튼을 클릭합니다.',
  '{B}출력{/B}',
  "Step1. '출력' 버튼을 클릭하여 현재 화면을 인쇄합니다.",
  '{B}출력{/B}',
  "Step1. '출력' 버튼을 클릭하여 현재 화면을 인쇄합니다.",
  '{B}저장{/B}',
  'Step1. 저장 버튼을 클릭합니다.',
].join('\n');

// 후처리 5 로직 시뮬레이션
const usageLines = aiText.split('\n');
const seenSectionTitles = new Set();
const dedupedLines = [];
let skipDuplicateSection = false;

for (const line of usageLines) {
  const sectionMatch = /^\{B\}(.+?)\{\/B\}$/.exec(line.trim());
  if (sectionMatch) {
    const sectionTitle = sectionMatch[1].trim();
    if (seenSectionTitles.has(sectionTitle)) {
      skipDuplicateSection = true;
      continue;
    }
    seenSectionTitles.add(sectionTitle);
    skipDuplicateSection = false;
  } else if (skipDuplicateSection) {
    if (/^Step\d+\./i.test(line.trim()) || /^\{MSG\}/.test(line.trim()) || !line.trim()) {
      continue;
    }
    skipDuplicateSection = false;
  }
  dedupedLines.push(line);
}

const result = dedupedLines.join('\n');
console.log('=== 후처리 5 결과 ===');
console.log(result);

// 검증
const sectionCount = [...result.matchAll(/\{B\}출력\{\/B\}/g)].length;
if (sectionCount === 1) {
  console.log('\n✅ 중복 "출력" 섹션 → 1개로 축소 완료');
} else {
  console.error(`\n❌ "출력" 섹션이 ${sectionCount}개 존재`);
  process.exit(1);
}

// 다른 섹션은 정상 유지 확인
const allSections = [...result.matchAll(/\{B\}([^{]+?)\{\/B\}/g)].map(m => m[1]);
const expected = ['조회', '출력', '저장'];
const match = JSON.stringify(allSections) === JSON.stringify(expected);
if (match) {
  console.log('✅ 전체 섹션 순서/구성 정상:', allSections.join(', '));
} else {
  console.error('❌ 섹션 구성 불일치:', allSections);
  process.exit(1);
}

console.log('\n✅ 모든 테스트 PASS');
