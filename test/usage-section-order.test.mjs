import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeUsageSections,
  getUsageSectionTitles,
  prepareUsageSections,
  sortUsageSections,
} from "../src/lib/ai/usage-section-order.ts";
import { renderHtml } from "../src/lib/output/html-renderer.ts";
import { renderMarkdown } from "../src/lib/output/markdown-renderer.ts";

function button(name, index) {
  return { name, index, functionName: `button${index}` };
}

function parseResult(aiUsageText) {
  return {
    filePath: "sample.clx.js",
    overview: {
      systemName: "학사",
      subSystem: "수업",
      programName: "수강 관리",
      appTitle: "",
      description: "",
      author: "",
      createDate: "",
    },
    usage: {
      menuTitleBar: {
        hasInquiry: true,
        hasNew: true,
        hasSave: true,
        hasDelete: true,
        extButtons: [button("출력", 1), button("엑셀", 2)],
      },
      extraButtons: [button("승인", 3), button("반려", 4)],
      titleBars: [
        {
          title: "상세 목록",
          hasInquiry: false,
          hasNew: true,
          hasSave: true,
          hasDelete: true,
          extButtons: [button("행 복사", 5)],
        },
        {
          title: "첨부 목록",
          hasInquiry: false,
          hasNew: false,
          hasSave: true,
          hasDelete: false,
          extButtons: [button("파일선택", 6)],
        },
      ],
    },
    aiUsageText,
    notes: { requiredFields: [], validations: [] },
    items: { conditionGroups: [], infoGroups: [], grids: [] },
    tabPages: [],
    popups: [],
    usedUdcs: [],
  };
}

function headingOrder(text, pattern = /^\s*\{B\}(.+?)\{\/B\}\s*$/gm) {
  return [...text.matchAll(pattern)].map((match) => match[1].trim());
}

test("업무 흐름순과 파서 배열 순서로 소제목을 생성한다", () => {
  assert.deepEqual(getUsageSectionTitles(parseResult()), [
    "조회", "신규", "저장", "삭제", "출력", "엑셀", "승인", "반려",
    "상세 목록 - 신규", "상세 목록 - 저장", "상세 목록 - 삭제", "상세 목록 - 행 복사",
    "첨부 목록 - 저장", "첨부 목록 - 파일선택",
  ]);
});

test("Step과 MSG 블록을 유지하며 알 수 없는 섹션은 마지막에 안정적으로 배치한다", () => {
  const input = `{B}상세 목록 - 삭제{/B}
Step1. 삭제 대상을 선택합니다.
{MSG}삭제할까요?{/MSG}
Step2. 삭제합니다.
{B}알 수 없음 B{/B}
Step1. B를 실행합니다.
{B}승인{/B}
Step1. 승인합니다.
{B}조회{/B}
Step1. 조건을 입력합니다.
{B}알 수 없음 A{/B}
Step1. A를 실행합니다.
{B}출력{/B}
Step1. 출력합니다.`;

  const sorted = sortUsageSections(input, parseResult(input));
  assert.deepEqual(headingOrder(sorted), [
    "조회", "출력", "승인", "상세 목록 - 삭제", "알 수 없음 B", "알 수 없음 A",
  ]);
  assert.match(sorted, /\{B\}상세 목록 - 삭제\{\/B\}\nStep1\.[\s\S]*\{MSG\}삭제할까요\?\{\/MSG\}\nStep2\./);
});

test("동일한 버튼명과 구버전 타이틀바 제목을 안정적으로 정렬한다", () => {
  const input = `{B}상세 목록 - 저장{/B}\nStep1. 저장합니다.\n{B}승인{/B}\nStep1. 승인합니다.\n{B}조회{/B}\nStep1. 조회합니다.\n{B}출력{/B}\nStep1. 출력합니다.`;
  assert.deepEqual(headingOrder(sortUsageSections(input, parseResult(input))), [
    "조회", "출력", "승인", "상세 목록 - 저장",
  ]);
  const legacyInput = `{B}상세 목록 저장{/B}\nStep1. 저장합니다.\n{B}승인{/B}\nStep1. 승인합니다.`;
  assert.deepEqual(headingOrder(sortUsageSections(legacyInput, parseResult(legacyInput))), [
    "승인", "상세 목록 저장",
  ]);
});

test("누락된 추가·독립·타이틀바 버튼을 보충한 뒤 고정 순서로 정렬한다", () => {
  const input = `{B}알 수 없음{/B}\nStep1. {B}승인{/B} 항목을 확인합니다.\n{B}조회{/B}\nStep1. 조회합니다.`;
  const prepared = prepareUsageSections(input, parseResult(input));
  const titles = headingOrder(prepared);

  assert.deepEqual(titles, [
    "조회", "출력", "엑셀", "승인", "반려",
    "상세 목록 - 신규", "상세 목록 - 저장", "상세 목록 - 삭제", "상세 목록 - 행 복사",
    "첨부 목록 - 저장", "첨부 목록 - 파일선택", "알 수 없음",
  ]);
  assert.match(prepared, /\{B\}상세 목록 - 행 복사\{\/B\}\nStep1\. '행 복사' 버튼/);
});

test("HTML과 Markdown에서 AI 섹션 순서가 동일하다", () => {
  const input = `{B}상세 목록 - 저장{/B}\nStep1. 저장합니다.\n{B}승인{/B}\nStep1. 승인합니다.\n{B}조회{/B}\nStep1. 조회합니다.\n{B}출력{/B}\nStep1. 출력합니다.`;
  const result = parseResult(input);
  const sections = [{ id: "usage", name: "사용법", enabled: true, order: 0 }];
  const html = renderHtml(result, sections);
  const markdown = renderMarkdown(result, sections);
  const expected = headingOrder(prepareUsageSections(input, result));

  const htmlTitles = headingOrder(html, /<span class="bold-tag">([^<]+)<\/span>/g);
  const markdownTitles = headingOrder(markdown, /^\*\*(.+?)\*\*$/gm);
  assert.deepEqual(htmlTitles, expected);
  assert.deepEqual(markdownTitles, expected);
});

test("HTML과 Markdown 폴백이 독립 버튼 뒤에 타이틀바 기능을 배치한다", () => {
  const result = parseResult();
  const sections = [{ id: "usage", name: "사용법", enabled: true, order: 0 }];
  const html = renderHtml(result, sections);
  const markdown = renderMarkdown(result, sections);

  const htmlTitles = headingOrder(html, /<span class="bold-tag">([^<]+)<\/span>/g);
  assert.ok(htmlTitles.indexOf("반려") < htmlTitles.indexOf("상세 목록 - 신규"));
  assert.match(markdown, /\| 승인 \|/);
  assert.match(markdown, /\| 상세 목록 신규 \|/);
  assert.ok(markdown.indexOf("| 반려 |") < markdown.indexOf("| 상세 목록 신규 |"));
});

test("기술적 버튼명과 사용자용 버튼명이 같은 섹션이면 상세 섹션만 보존한다", () => {
  const input = `{B}PatisMenuTitleBar [메시지발송]{/B}
Step1. '메시지발송' 버튼을 클릭한다.
Step2. 처리 결과를 확인한다.
{B}메시지발송{/B}
Step1. 변동 리스트에서 학생을 선택한다.
Step2. 메시지발송 버튼을 클릭한다.
{MSG}메시지발송 준비중입니다.{/MSG}`;
  const result = parseResult(input);
  result.usage.menuTitleBar.extButtons = [button("PatisMenuTitleBar [메시지발송]", 1)];
  result.usage.extraButtons = [];
  result.usage.titleBars = [];

  const prepared = prepareUsageSections(input, result);
  assert.deepEqual(headingOrder(prepared).filter((title) => title.includes("메시지")), ["메시지발송"]);
  assert.doesNotMatch(prepared, /PatisMenuTitleBar/);
  assert.match(prepared, /변동 리스트에서 학생을 선택/);
  assert.match(prepared, /\{MSG\}메시지발송 준비중입니다\.\{\/MSG\}/);
});

test("기술적 제목만 있으면 내용을 유지하고 사용자용 제목으로 변환한다", () => {
  const input = `{B}PatisTitleBar [일괄승인]{/B}\nStep1. 승인 대상을 선택한다.`;
  const canonical = canonicalizeUsageSections(input);

  assert.deepEqual(headingOrder(canonical), ["일괄승인"]);
  assert.match(canonical, /Step1\. 승인 대상을 선택한다\./);
});
