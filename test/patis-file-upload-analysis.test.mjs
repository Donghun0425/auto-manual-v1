import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyUdcSynthesis,
  filterUsageUdcContext,
} from "../src/lib/ai/synthesize-udc-items.ts";
import { parseInfoGroups } from "../src/lib/parser/infoGroupParser.ts";
import { resolveUdc } from "../src/lib/parser/udc-label-resolver.ts";
import { parseUdcFile } from "../src/lib/parser/udc-parser.ts";

function fileUploadDetail() {
  const defaults = {
    isMultiUpload: "false",
    selectButtonText: "파일선택",
    downloadButtonText: "다운로드",
    deleteButtonText: "파일삭제",
    searchButtonText: "조회",
    saveButtonText: "저장",
    isSelectButtonVisible: "true",
    isDownloadButtonVisible: "true",
    isDeleteButtonVisible: "true",
    isInqButtonVisible: "true",
    isSaveButtonVisible: "true",
  };
  const controls = [
    ["T_TITLE_TEXT", "label", "조회"],
    ["BTN_UPLOAD_POPUP_OPEN", "button", null],
    ["BTN_DOWNLOAD", "button", null],
    ["BTN_DELETE", "button", null],
    ["BTN_INQ", "button", "조회"],
    ["BTN_SAVE", "button", "저장"],
  ];
  return {
    component: {
      short_name: "PatisFileUpload",
      qualified_name: "udc.common.PatisFileUpload",
      display_name: "공통 파일업로드 컴포넌트",
      component_type: "file_upload",
      description: null,
      section_usage: ["처리조건"],
    },
    controls: controls.map(([controlId, controlType, defaultLabel], displayOrder) => ({
      control_id: controlId,
      control_type: controlType,
      default_label: defaultLabel,
      display_order: displayOrder,
      is_label_control: controlType === "label",
      action_type: null,
      action_target: null,
      grid_columns: null,
      cascade_config: null,
    })),
    properties: Object.entries(defaults).map(([propertyName, defaultValue]) => ({
      property_name: propertyName,
      default_value: defaultValue,
      target_attribute: null,
      target_control_id: null,
    })),
    functions: [],
  };
}

function parseResultFor(content) {
  return {
    usage: {
      menuTitleBar: {
        hasInquiry: true,
        hasNew: true,
        hasSave: true,
        hasDelete: true,
        extButtons: [],
      },
      titleBars: [],
      extraButtons: [],
    },
    items: {
      infoGroups: parseInfoGroups(content),
      conditionGroups: [],
      grids: [{ title: "반대표 목록" }],
    },
  };
}

test("isMultiUpload=false에서 파일선택과 저장 visible을 적용한다", () => {
  const detail = fileUploadDetail();
  const resolved = resolveUdc(detail, `
    var file = new udc.common.PatisFileUpload("D_FILE");
    file.isMultiUpload = false;
    file.isSelectButtonVisible = true;
    file.isSaveButtonVisible = false;
  `);
  const actions = resolved.instances[0].actions;

  assert.equal(actions.find((action) => action.controlId === "BTN_UPLOAD_POPUP_OPEN").visibility, "visible");
  assert.equal(actions.find((action) => action.controlId === "BTN_SAVE").visibility, "hidden");
  assert.deepEqual(resolved.actions.map((action) => action.label), ["파일선택", "다운로드", "파일삭제", "조회"]);
});

test("isMultiUpload=true 또는 비리터럴이면 파일선택과 저장을 제외한다", () => {
  const detail = fileUploadDetail();
  for (const value of ["true", "dynamicValue"]) {
    const resolved = resolveUdc(detail, `
      var file = new udc.common.PatisFileUpload("D_FILE");
      file.isMultiUpload = ${value};
      file.isSelectButtonVisible = true;
      file.isSaveButtonVisible = true;
    `);
    assert.doesNotMatch(resolved.actions.map((action) => action.label).join(","), /파일선택|저장/);
  }
});

test("실제 화면의 PatisFileUpload 액션을 사용방법에 합성하지 않는다", () => {
  const content = readFileSync("sample/usm_3070507_u.clx.js", "utf8");
  const resolved = resolveUdc(fileUploadDetail(), content);
  const parseResult = parseResultFor(content);

  assert.deepEqual(resolved.actions.map((action) => action.label), ["파일선택", "다운로드", "파일삭제"]);
  applyUdcSynthesis(parseResult, { available: true, udcs: [resolved] }, content);

  assert.deepEqual(parseResult.usage.titleBars, []);
});

test("일반 AI 문맥은 유지하고 사용방법 AI 문맥에서만 PatisFileUpload를 제외한다", () => {
  const content = readFileSync("sample/usm_3070507_u.clx.js", "utf8");
  const resolved = resolveUdc(fileUploadDetail(), content);
  const ctx = { available: true, udcs: [resolved] };
  const usageCtx = filterUsageUdcContext(ctx);

  assert.deepEqual(ctx.udcs, [resolved]);
  assert.deepEqual(usageCtx.udcs, []);
  assert.equal(usageCtx.available, false);
});

test("UDC 메타데이터에 단일 업로드 적용 조건을 저장한다", () => {
  const source = `
/// start - udc.common.PatisFileUpload
app.declareAppProperty("isMultiUpload", false);
app.declareAppProperty("isSelectButtonVisible", true);
app.declareAppProperty("isSaveButtonVisible", true);
function setSelectButtonVisible(value) { app.lookup("BTN_UPLOAD_POPUP_OPEN").visible = value; }
function setIsSaveButtonVisible(value) { app.lookup("BTN_SAVE").visible = value; }
exports.setSelectButtonVisible = setSelectButtonVisible;
exports.setIsSaveButtonVisible = setIsSaveButtonVisible;
var select = new cpr.controls.Button("BTN_UPLOAD_POPUP_OPEN");
var save = new cpr.controls.Button("BTN_SAVE");
internalApp.title = "파일업로드";
/// end - udc.common.PatisFileUpload
`;
  const parsed = parseUdcFile("udc.js", source).udcs[0];
  const selectTarget = parsed.functions
    .find((fn) => fn.function_name === "setSelectButtonVisible")
    .target_controls.find((target) => target.control_id === "BTN_UPLOAD_POPUP_OPEN");
  const saveTarget = parsed.functions
    .find((fn) => fn.function_name === "setIsSaveButtonVisible")
    .target_controls.find((target) => target.control_id === "BTN_SAVE");

  const expected = [{ property_name: "isMultiUpload", operator: "equals", value: false }];
  assert.deepEqual(selectTarget.applies_when, expected);
  assert.deepEqual(saveTarget.applies_when, expected);
});
