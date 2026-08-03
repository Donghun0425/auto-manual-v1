import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyUdcVisibilityToConditionGroups } from "../src/lib/ai/apply-udc-visibility.ts";
import { resolveUdc } from "../src/lib/parser/udc-label-resolver.ts";
import { parseUdcFile } from "../src/lib/parser/udc-parser.ts";

const UDC_SOURCE = `
/// start - udc.univ.UcoSrchComnt
var clgVisible = true;
var facltVisible = true;
var majorVisible = true;
function setObjectVisible(clgParam, facltParam, majorParam) {
  clgVisible = clgParam;
  facltVisible = facltParam;
  majorVisible = majorParam;
  privateObjectWidth();
}
function privateObjectWidth() {
  var layouts = app.lookup("wrapper").getLayout();
  layouts.setColumnVisible(0, clgVisible);
  layouts.setColumnVisible(1, clgVisible);
  layouts.setColumnVisible(2, facltVisible);
  layouts.setColumnVisible(3, facltVisible);
  layouts.setColumnVisible(4, majorVisible);
  layouts.setColumnVisible(5, majorVisible);
}
exports.setObjectVisible = setObjectVisible;
var wrapper = new cpr.controls.Container("wrapper");
(function(container) {
  var label1 = new cpr.controls.Output("T_S_CLG");
  label1.value = "대학";
  container.addChild(label1, { "colIndex": 0 });
  var combo1 = new cpr.controls.ComboBox("S_CLG");
  container.addChild(combo1, { "colIndex": 1 });
  var label2 = new cpr.controls.Output("T_S_FACLT_SCSBJT");
  label2.value = "학과";
  container.addChild(label2, { "colIndex": 2 });
  var combo2 = new cpr.controls.ComboBox("S_FACLT_SCSBJT");
  container.addChild(combo2, { "colIndex": 3 });
  var label3 = new cpr.controls.Output("T_S_SCSBJT_MJR");
  label3.value = "전공";
  container.addChild(label3, { "colIndex": 4 });
  var combo3 = new cpr.controls.ComboBox("S_SCSBJT_MJR");
  container.addChild(combo3, { "colIndex": 5 });
})(wrapper);
internalApp.title = "대학/학과/전공";
/// end - udc.univ.UcoSrchComnt
`;

function detailFromParsed() {
  const parsed = parseUdcFile("udc.js", UDC_SOURCE).udcs[0];
  const udcId = "udc-id";
  return {
    parsed,
    detail: {
      component: { ...parsed.component, id: udcId, created_at: "", updated_at: "" },
      controls: parsed.controls.map((control, index) => ({ ...control, id: `c${index}`, udc_id: udcId })),
      properties: parsed.properties.map((property, index) => ({ ...property, id: `p${index}`, udc_id: udcId })),
      functions: parsed.functions.map((fn, index) => ({ ...fn, id: `f${index}`, udc_id: udcId })),
    },
  };
}

test("UDC parser maps each visible parameter to label and input controls", () => {
  const { parsed } = detailFromParsed();
  const fn = parsed.functions.find((item) => item.function_name === "setObjectVisible");
  assert.ok(fn);
  assert.deepEqual(
    fn.target_controls.map((target) => [target.parameter_position, target.control_id]),
    [
      [0, "T_S_CLG"], [0, "S_CLG"],
      [1, "T_S_FACLT_SCSBJT"], [1, "S_FACLT_SCSBJT"],
      [2, "T_S_SCSBJT_MJR"], [2, "S_SCSBJT_MJR"],
    ]
  );
});

test("actual screen resolves setObjectVisible(true, true, false) to 대학 / 학과", () => {
  const { detail } = detailFromParsed();
  const content = readFileSync("sample/utc_3080207_u.clx.js", "utf8");
  const resolved = resolveUdc(detail, content);

  assert.deepEqual(
    resolved.instances[0].resolvedLabels.map((label) => label.resolvedLabel),
    ["대학", "학과"]
  );

  const parseResult = {
    items: {
      conditionGroups: [{
        groupId: "SEARCHGROUP01",
        groupType: "조회조건",
        controls: [{
          controlId: "S_SDEPT_COMBO",
          controlType: "UcoSrchComnt",
          labelText: "대학 / 학과 / 전공",
          description: "",
          inputType: "입력",
        }],
      }],
    },
  };
  applyUdcVisibilityToConditionGroups(parseResult, { udcs: [resolved], available: true });
  assert.equal(parseResult.items.conditionGroups[0].controls[0].labelText, "대학 / 학과");
});

test("visibility calls use the last literal value per instance and ignore dynamic arguments", () => {
  const { detail } = detailFromParsed();
  const content = `
    var first = new udc.univ.UcoSrchComnt("FIRST");
    first.setObjectVisible(true, false, false);
    first.setObjectVisible(dynamicValue, true, false);
    var second = new udc.univ.UcoSrchComnt("SECOND");
    app.lookup("SECOND").setObjectVisible(true, true, true);
  `;
  const resolved = resolveUdc(detail, content);
  assert.deepEqual(
    resolved.instances.map((instance) => [
      instance.instanceId,
      instance.resolvedLabels.map((label) => label.resolvedLabel),
    ]),
    [
      ["FIRST", ["대학", "학과"]],
      ["SECOND", ["대학", "학과", "전공"]],
    ]
  );
});

test("stale UDC metadata cannot re-introduce a condition hidden by direct CLX analysis", () => {
  const labels = ["대학", "학과", "전공"].map((resolvedLabel, index) => ({
    shortName: "UcoSrchComnt",
    functionName: "",
    resolvedLabel,
    targetControlId: [`T_S_CLG`, `T_S_FACLT_SCSBJT`, `T_S_SCSBJT_MJR`][index],
    defaultLabel: resolvedLabel,
  }));
  const udc = {
    shortName: "UcoSrchComnt",
    qualifiedName: "udc.univ.UcoSrchComnt",
    displayName: "대학/학과/전공",
    componentType: "cascading_combo",
    description: null,
    sectionUsage: ["조회조건"],
    resolvedLabels: [...labels],
    instances: [{ instanceId: "S_SDEPT_COMBO", resolvedLabels: [...labels] }],
    gridColumns: [],
    cascade: null,
    actions: [],
  };
  const parseResult = {
    items: {
      conditionGroups: [{
        groupId: "SEARCHGROUP01",
        groupType: "조회조건",
        controls: [{
          controlId: "S_SDEPT_COMBO",
          controlType: "UcoSrchComnt",
          labelText: "대학 / 학과",
          description: "",
          inputType: "입력",
        }],
      }],
    },
  };

  applyUdcVisibilityToConditionGroups(parseResult, { udcs: [udc], available: true });
  assert.equal(parseResult.items.conditionGroups[0].controls[0].labelText, "대학 / 학과");
  assert.deepEqual(udc.resolvedLabels.map((label) => label.resolvedLabel), ["대학", "학과"]);
});
