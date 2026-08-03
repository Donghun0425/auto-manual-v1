import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseConditionGroups } from "../src/lib/parser/conditionGroupParser.ts";

test("SEARCHGROUP UDC visible override and visible false child labels are handled", () => {
  const content = readFileSync("sample/aac_4040101_u.clx.js", "utf8");

  const group = parseConditionGroups(content).find((item) => item.groupId === "SEARCHGROUP01");

  assert.ok(group);
  assert.deepEqual(
    group.controls.map((control) => [control.controlId, control.labelText]),
    [
      ["S_ACNTG_COMBO", "회계년도 / 회계단위"],
      ["S_ACNTL_LVL_SE", "계정레벨"],
    ],
  );
});

test("UcoSrchComnt positional setObjectVisible hides the major condition", () => {
  const content = readFileSync("sample/utc_3080207_u.clx.js", "utf8");
  const group = parseConditionGroups(content).find((item) => item.groupId === "SEARCHGROUP01");

  assert.ok(group);
  assert.equal(group.controls.find((control) => control.controlId === "S_SDEPT_COMBO")?.labelText, "대학 / 학과");
});
