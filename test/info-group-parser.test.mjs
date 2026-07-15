import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseGrids } from "../src/lib/parser/gridParser.ts";
import { parseInfoGroups } from "../src/lib/parser/infoGroupParser.ts";

test("INFOGROUP의 T_S 라벨과 S 컨트롤 쌍을 항목으로 추출한다", () => {
  const content = readFileSync("sample/usc_3010701_u.clx.js", "utf8");

  const groups = parseInfoGroups(content);
  const infoGroup = groups.find((group) => group.groupId === "INFOGROUP01");

  assert.ok(infoGroup);
  assert.equal(infoGroup.title, "소속일괄변경 대상자 생성");
  assert.deepEqual(
    infoGroup.controls.map((control) => control.labelText),
    ["처리방법", "현재소속", "처리대상", "학년", "개별검색", "소속", "변경소속"],
  );
  assert.equal(
    infoGroup.controls.find((control) => control.controlId === "S_PRCS_MTHD")?.inputType,
    "입력",
  );
});

test("GRID_GROUP 안의 INFO 타이틀을 그리드 제목으로 오인하지 않는다", () => {
  const content = readFileSync("sample/usc_3010701_u.clx.js", "utf8");

  const grids = parseGrids(content);
  const grid = grids.find((item) => item.gridId === "DG_GRID01");

  assert.ok(grid);
  assert.equal(grid.title, "대상자리스트");
});
