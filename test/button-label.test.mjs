import assert from "node:assert/strict";
import test from "node:test";

import {
  findButtonByLabel,
  normalizeFrameworkButtonLabel,
} from "../src/lib/button-label.ts";
import { parseMenuTitleBarCrud } from "../src/lib/parser/crudParser.ts";

test("Patis 타이틀바 주석 버튼명만 사용자용 라벨로 정규화한다", () => {
  assert.equal(normalizeFrameworkButtonLabel("PatisMenuTitleBar [메시지발송]"), "메시지발송");
  assert.equal(normalizeFrameworkButtonLabel("PatisTitleBar 추가버튼2 [일괄승인]"), "일괄승인");
  assert.equal(normalizeFrameworkButtonLabel("상태 [완료]"), "상태 [완료]");
});

test("AI가 정규화된 이름을 반환해도 유일한 원본 버튼에 매칭한다", () => {
  const button = { name: "PatisMenuTitleBar [메시지발송]", functionName: "Form_ext1Click" };
  assert.equal(findButtonByLabel([button], "메시지발송"), button);

  const duplicate = { name: "메시지발송", functionName: "OtherClick" };
  assert.equal(findButtonByLabel([button, duplicate], " 메시지발송 "), undefined);
  assert.equal(findButtonByLabel([button, duplicate], "메시지발송"), duplicate);
});

test("Form_ext 주석의 기술적 이름을 파서 경계에서 정규화한다", () => {
  const content = `
    /**
     * PatisMenuTitleBar [메시지발송]
     */
    function Form_ext1Click(obj, e) {
      app.alert("메시지발송 준비중입니다.");
      return false;
    }
  `;

  const parsed = parseMenuTitleBarCrud(content);
  assert.equal(parsed.extButtons.length, 1);
  assert.equal(parsed.extButtons[0].name, "메시지발송");
  assert.deepEqual(parsed.extButtons[0].logic?.guards, ["메시지발송 준비중입니다."]);
});
