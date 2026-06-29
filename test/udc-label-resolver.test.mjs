import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveUdc } from "../src/lib/parser/udc-label-resolver.ts";
import { removeDuplicateUdcUsageSections } from "../src/lib/ai/udc-usage-dedupe.ts";
import { applyUdcSynthesis } from "../src/lib/ai/synthesize-udc-items.ts";

function fileUploadDetail() {
  const defaults = {
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
    ["BTN_UPLOAD_POPUP_OPEN", null],
    ["BTN_DOWNLOAD", null],
    ["BTN_DELETE", null],
    ["BTN_INQ", "조회"],
    ["BTN_SAVE", "저장"],
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
    controls: controls.map(([controlId, defaultLabel], displayOrder) => ({
      control_id: controlId,
      control_type: "button",
      default_label: defaultLabel,
      display_order: displayOrder,
      is_label_control: false,
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

function actionLabels(content, detail = fileUploadDetail()) {
  return resolveUdc(detail, content).actions.map((action) => action.label);
}

test("abg_4030301 화면에서는 파일선택, 다운로드, 파일삭제만 노출한다", () => {
  const content = readFileSync("sample/abg_4030301_u.clx.js", "utf8");

  assert.deepEqual(actionLabels(content), ["파일선택", "다운로드", "파일삭제"]);
});

test("인스턴스별 버튼 문구와 visible 오버라이드를 반영한다", () => {
  const content = `
    var file = new udc.common.PatisFileUpload("D_FILE");
    file.setSelectButtonText("첨부 선택");
    file.isDownloadButtonVisible = false;
    app.lookup("D_FILE").isDeleteButtonVisible = false;
    file.isInqButtonVisible = false;
    file.isSaveButtonVisible = false;
  `;

  assert.deepEqual(actionLabels(content), ["첨부 선택"]);
});

test("동일 UDC가 여러 개이면 하나라도 보이는 액션을 중복 없이 유지한다", () => {
  const content = `
    var first = new udc.common.PatisFileUpload("FIRST");
    first.isDownloadButtonVisible = false;
    first.isInqButtonVisible = false;
    first.isSaveButtonVisible = false;
    var second = new udc.common.PatisFileUpload("SECOND");
    second.isInqButtonVisible = false;
    second.isSaveButtonVisible = false;
  `;

  assert.deepEqual(actionLabels(content), ["파일선택", "다운로드", "파일삭제"]);
});

test("파일 액션 메타데이터가 없으면 기존 컨트롤 라벨로 폴백한다", () => {
  const detail = fileUploadDetail();
  detail.properties = [];

  assert.deepEqual(actionLabels("", detail), ["조회", "저장"]);
});

test("UDC 버튼이 다른 타이틀바에 반복 생성되면 실제 소유 섹션만 유지한다", () => {
  const parseResult = {
    usage: {
      titleBars: [
        {
          title: "사업코드 리스트",
          extButtons: [],
        },
        {
          title: "공통 파일업로드 컴포넌트",
          extButtons: [
            { name: "파일선택", functionName: "UDC_BTN_UPLOAD_POPUP_OPEN" },
            { name: "다운로드", functionName: "UDC_BTN_DOWNLOAD" },
          ],
        },
      ],
    },
  };
  const usageText = `{B}사업코드 리스트 - 파일선택{/B}
Step1. 잘못 복제된 설명입니다.
{B}공통 파일업로드 컴포넌트 - 파일선택{/B}
Step1. 파일을 선택합니다.
{B}공통 파일업로드 컴포넌트 - 다운로드{/B}
Step1. 파일을 다운로드합니다.`;

  assert.equal(
    removeDuplicateUdcUsageSections(usageText, parseResult),
    `{B}공통 파일업로드 컴포넌트 - 파일선택{/B}
Step1. 파일을 선택합니다.
{B}공통 파일업로드 컴포넌트 - 다운로드{/B}
Step1. 파일을 다운로드합니다.`
  );
});

test("실제 UDC 소유 섹션이 없으면 기존 안내를 보존한다", () => {
  const parseResult = {
    usage: {
      titleBars: [{
        title: "공통 파일업로드 컴포넌트",
        extButtons: [{ name: "파일선택", functionName: "UDC_BTN_UPLOAD_POPUP_OPEN" }],
      }],
    },
  };
  const usageText = `{B}사업코드 리스트 - 파일선택{/B}\nStep1. 파일을 선택합니다.`;

  assert.equal(removeDuplicateUdcUsageSections(usageText, parseResult), usageText);
});

test("파일 UDC에 전용 타이틀이 없으면 업무 목록명을 기능 제목으로 사용한다", () => {
  const parseResult = {
    usage: {
      titleBars: [{
        title: "사업코드 리스트",
        hasInquiry: false,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [],
      }],
    },
    items: {
      grids: [{ title: "사업코드 리스트" }],
      infoGroups: [],
    },
  };
  const udc = {
    shortName: "PatisFileUpload",
    displayName: "공통 파일업로드 컴포넌트",
    componentType: "file_upload",
    actions: [{
      controlId: "BTN_UPLOAD_POPUP_OPEN",
      label: "파일선택",
      actionType: null,
      actionTarget: null,
    }],
    resolvedLabels: [],
  };

  applyUdcSynthesis(
    parseResult,
    { available: true, udcs: [udc] },
    `var file = new udc.common.PatisFileUpload("D_FILE");`
  );

  assert.deepEqual(
    parseResult.usage.titleBars.map((bar) => ({
      title: bar.title,
      buttons: bar.extButtons.map((button) => button.name),
    })),
    [{ title: "사업코드 리스트", buttons: ["파일선택"] }]
  );
});
