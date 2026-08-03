import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderHtml } from "../src/lib/output/html-renderer.ts";
import { renderMarkdown } from "../src/lib/output/markdown-renderer.ts";
import { parseMenuTitleBarCrud, parseTitleBarCrud } from "../src/lib/parser/crudParser.ts";
import { parseValidations } from "../src/lib/parser/validationParser.ts";
import { normalizeMessage } from "../src/lib/utils.ts";

function parseResult(message) {
  return {
    filePath: "sample.clx.js",
    overview: {
      systemName: "시스템",
      subSystem: "업무",
      programName: "프로그램",
      appTitle: "",
      description: "",
      author: "",
      createDate: "",
    },
    usage: {
      menuTitleBar: {
        hasInquiry: false,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [],
      },
      extraButtons: [],
      titleBars: [],
    },
    aiUsageText: `{B}확인{/B}\n{MSG}${message}{/MSG}`,
    notes: {
      requiredFields: [],
      validations: [{ functionName: "onClick", message }],
    },
    items: { conditionGroups: [], infoGroups: [], grids: [] },
    tabPages: [],
    popups: [],
    usedUdcs: [],
  };
}

test("메시지의 이스케이프 개행과 실제 제어 문자를 공백으로 정규화한다", () => {
  assert.equal(
    normalizeMessage("첫째\\r\\n둘째\\n셋째\\r넷째\\t다섯째\r\n여섯째\t끝"),
    "첫째 둘째 셋째 넷째 다섯째 여섯째 끝",
  );
});

test("유니코드 이스케이프와 서로게이트 쌍을 실제 문자로 변환한다", () => {
  assert.equal(normalizeMessage("\\u203b 안내"), "※ 안내");
  assert.equal(normalizeMessage("\\u023b 문자"), "Ȼ 문자");
  assert.equal(normalizeMessage("\\uD83D\\uDE00"), "😀");
  assert.equal(normalizeMessage("\\u{1F600}"), "😀");
});

test("잘못된 유니코드 이스케이프는 원문을 유지한다", () => {
  assert.equal(normalizeMessage("\\u12G4 안내"), "\\u12G4 안내");
  assert.equal(normalizeMessage("\\u{110000} 안내"), "\\u{110000} 안내");
});

test("validation 파서는 alert와 app.alert의 정적 메시지를 동일하게 정규화한다", () => {
  const content = String.raw`
function save() {
  alert("첫 문장\n두 번째 문장");
  app.alert('\u203b 안내\r\n확인해 주세요.');
}`;

  assert.deepEqual(parseValidations(content), [
    { functionName: "save", message: "첫 문장 두 번째 문장" },
    { functionName: "save", message: "※ 안내 확인해 주세요." },
  ]);
});

test("CRUD 분석의 alert와 confirm 메시지에도 같은 정규화를 적용한다", () => {
  const content = String.raw`
function Form_ext1Click(e) {
  app.alert("\u203b 확인\n필수입니다.");
  if (!app.confirm("계속하시겠습니까?\r\n확인해 주세요.")) return;
  app.serv("save");
}`;
  const logic = parseMenuTitleBarCrud(content).extButtons[0]?.logic;

  assert.deepEqual(logic?.validations, ["※ 확인 필수입니다."]);
  assert.deepEqual(logic?.confirmMessages, ["계속하시겠습니까? 확인해 주세요."]);
});

test("타이틀바 제목의 유니코드 이스케이프를 실제 문자로 변환한다", () => {
  const content = readFileSync(
    new URL("../sample/usm_3070505_u.clx.js", import.meta.url),
    "utf8",
  );
  const titleBar = parseTitleBarCrud(content).find(({ title }) =>
    title?.startsWith("참여인원"),
  );

  assert.equal(
    titleBar?.title,
    "참여인원 (※활동내역을 먼저 저장해야 등록이 가능합니다.)",
  );
  assert.doesNotMatch(titleBar?.title ?? "", /\\u203b/);
});

test("실제 CLX 샘플의 alert 개행이 매뉴얼 메시지에 남지 않는다", () => {
  const content = readFileSync(new URL("../sample/utc_3080207_u.clx.js", import.meta.url), "utf8");
  const validation = parseValidations(content).find(({ message }) =>
    message.includes("반려사유가 입력되지 않았습니다."),
  );

  assert.equal(validation?.message, "반려사유가 입력되지 않았습니다. 입력 후 진행해 주세요.");
  assert.doesNotMatch(validation?.message ?? "", /\\n|[\r\n]/);
});

test("HTML과 Markdown 렌더러가 기존 저장 메시지도 방어적으로 정규화한다", () => {
  const escapedMessage = "\\u203b 안내사항입니다.\\n확인해 주세요.";
  const result = parseResult(escapedMessage);
  const sections = [
    { id: "usage", name: "사용방법", enabled: true, order: 0 },
    { id: "notes", name: "참고사항", enabled: true, order: 1 },
  ];

  for (const output of [renderHtml(result, sections), renderMarkdown(result, sections)]) {
    assert.match(output, /※ 안내사항입니다\. 확인해 주세요\./);
    assert.doesNotMatch(output, /\\u203b|\\n/);
  }
});
