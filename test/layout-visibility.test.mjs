import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseExtraButtons, parseTitleBarCrud } from "../src/lib/parser/crudParser.ts";
import { parseGrids } from "../src/lib/parser/gridParser.ts";
import { createLayoutVisibilityResolver } from "../src/lib/parser/visibility.ts";

test("LAYOUT_WORK의 정적 숨김 행에 배치된 그리드를 제외한다", () => {
  const content = readFileSync("sample/usm_3070507_u.clx.js", "utf8");
  const grids = parseGrids(content).map((grid) => grid.gridId);

  assert.deepEqual(grids, ["DG_GRID01", "DG_GRID02"]);
});

const nestedLayoutContent = String.raw`
var root = new cpr.controls.Container("ROOT");
var rootLayout = new cpr.controls.layouts.FormLayout();
rootLayout.setRowVisible(1, false);
rootLayout.setRowVisible(2, false);
rootLayout.setColumnVisible(1, false);
root.setLayout(rootLayout);
(function(container){
  var hiddenGroup = new cpr.controls.Container("HIDDEN_GROUP");
  var hiddenLayout = new cpr.controls.layouts.FormLayout();
  hiddenGroup.setLayout(hiddenLayout);
  (function(container){
    var hiddenButton = new cpr.controls.Button("BTN_HIDDEN");
    hiddenButton.value = "숨김 실행";
    hiddenButton.addEventListener("click", BTN_HIDDEN_click);
    container.addChild(hiddenButton, { "rowIndex": 0, "colIndex": 0 });
    var hiddenTitle = new udc.common.PatisTitleBar("TITLE_HIDDEN");
    hiddenTitle.title = "숨김 기능";
    hiddenTitle.isSaveButtonVisible = true;
    container.addChild(hiddenTitle, { "rowIndex": 0, "colIndex": 1 });
    var hiddenUdc = new udc.sample.HiddenInfo("UDC_HIDDEN");
    container.addChild(hiddenUdc, { "rowIndex": 0, "colIndex": 2 });
  })(hiddenGroup);
  container.addChild(hiddenGroup, { "rowIndex": 1, "colIndex": 0 });

  var dynamicButton = new cpr.controls.Button("BTN_DYNAMIC");
  dynamicButton.value = "동적 실행";
  dynamicButton.addEventListener("click", BTN_DYNAMIC_click);
  container.addChild(dynamicButton, { "rowIndex": 2, "colIndex": 0 });

  var spanned = new cpr.controls.Button("BTN_SPANNED");
  spanned.value = "부분 노출";
  spanned.addEventListener("click", BTN_SPANNED_click);
  container.addChild(spanned, { "rowIndex": 0, "rowSpan": 2, "colIndex": 0 });

  var hiddenColumn = new cpr.controls.Button("BTN_HIDDEN_COLUMN");
  container.addChild(hiddenColumn, { "rowIndex": 0, "colIndex": 1 });
})(root);
app.lookup("ROOT").getLayout().setRowVisible(2, true);
function BTN_HIDDEN_click() {}
function BTN_DYNAMIC_click() {}
function BTN_SPANNED_click() {}
function TitleForm_saveAction() { app.lookup("ds").setRowState(0, 1); }
`;

test("숨김 부모의 자손과 숨김 열을 제외하고 동적·span 영역은 유지한다", () => {
  const visibility = createLayoutVisibilityResolver(nestedLayoutContent);

  assert.equal(visibility.isVisible("HIDDEN_GROUP"), false);
  assert.equal(visibility.isVisible("BTN_HIDDEN"), false);
  assert.equal(visibility.isVisible("TITLE_HIDDEN"), false);
  assert.equal(visibility.isVisible("UDC_HIDDEN"), false);
  assert.equal(visibility.isVisible("BTN_HIDDEN_COLUMN"), false);
  assert.equal(visibility.isVisible("BTN_DYNAMIC"), true);
  assert.equal(visibility.isVisible("BTN_SPANNED"), true);
});

test("숨김 버튼과 타이틀바를 사용방법 원천에서 제외한다", () => {
  assert.deepEqual(
    parseExtraButtons(nestedLayoutContent).map((button) => button.name),
    ["동적 실행", "부분 노출"],
  );
  assert.deepEqual(parseTitleBarCrud(nestedLayoutContent), []);
});
