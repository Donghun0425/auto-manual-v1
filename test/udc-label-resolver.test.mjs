import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveUdc } from "../src/lib/parser/udc-label-resolver.ts";
import {
  removeDuplicateTitleBarUsageSections,
  removeDuplicateUdcUsageSections,
} from "../src/lib/ai/udc-usage-dedupe.ts";
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

test("메뉴 조회와 타이틀바 조회를 서로 다른 사용방법으로 보존한다", () => {
  const parseResult = {
    usage: {
      menuTitleBar: {
        hasInquiry: true,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [],
      },
      titleBars: [{
        title: "휴학신청정보",
        extButtons: [{ name: "조회", functionName: "UDC_BTN_INQ" }],
      }],
    },
  };
  const usageText = `{B}조회{/B}
Step1. 학생을 선택합니다.
{MSG}학생을 선택해주시기 바랍니다.{/MSG}
Step2. 조회 조건을 입력합니다.
Step3. 조회 버튼을 클릭합니다.
Step4. 결과를 확인합니다.

{B}휴학신청정보 - 조회{/B}
Step1. 최신 파일 정보를 조회합니다.`;

  assert.equal(removeDuplicateTitleBarUsageSections(usageText, parseResult), usageText);
});

test("조회 Step2 뒤에 MSG가 있어도 메뉴 조회 섹션 전체를 보존한다", () => {
  const parseResult = {
    usage: {
      menuTitleBar: {
        hasInquiry: true,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [],
      },
      titleBars: [{
        title: "휴학신청정보",
        extButtons: [{ name: "조회", functionName: "UDC_BTN_INQ" }],
      }],
    },
  };
  const usageText = `{B}조회{/B}
Step1. 조건을 입력합니다.
Step2. 학생을 선택합니다.
{MSG}학생을 선택해주시기 바랍니다.{/MSG}
Step3. 조회 버튼을 클릭합니다.
{B}휴학신청정보 - 조회{/B}
Step1. 타이틀바 조회를 실행합니다.`;

  assert.equal(removeDuplicateTitleBarUsageSections(usageText, parseResult), usageText);
});

test("메뉴 CRUD와 동일한 타이틀바 버튼명은 단독 섹션을 보존한다", () => {
  const cases = [
    ["조회", "hasInquiry"],
    ["신규", "hasNew"],
    ["저장", "hasSave"],
    ["삭제", "hasDelete"],
  ];

  for (const [buttonName, flag] of cases) {
    const menuTitleBar = {
      hasInquiry: false,
      hasNew: false,
      hasSave: false,
      hasDelete: false,
      extButtons: [],
      [flag]: true,
    };
    const parseResult = {
      usage: {
        menuTitleBar,
        titleBars: [{
          title: "상세 정보",
          extButtons: [{ name: buttonName, functionName: `BTN_${buttonName}` }],
        }],
      },
    };
    const usageText = `{B}${buttonName}{/B}\nStep1. 메뉴 기능을 실행합니다.\n{B}상세 정보 - ${buttonName}{/B}\nStep1. 타이틀바 기능을 실행합니다.`;

    assert.equal(removeDuplicateTitleBarUsageSections(usageText, parseResult), usageText);
  }
});

test("메뉴 확장 버튼과 동일한 타이틀바 버튼명은 단독 섹션을 보존한다", () => {
  const parseResult = {
    usage: {
      menuTitleBar: {
        hasInquiry: false,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [{ name: "출력", functionName: "Form_ext1Click" }],
      },
      titleBars: [{
        title: "상세 정보",
        extButtons: [{ name: "출력", functionName: "BTN_PRINT" }],
      }],
    },
  };
  const usageText = `{B}출력{/B}
Step1. 메뉴에서 출력합니다.
{B}상세 정보 - 출력{/B}
Step1. 타이틀바에서 출력합니다.`;

  assert.equal(removeDuplicateTitleBarUsageSections(usageText, parseResult), usageText);
});

test("실제 중복 단독 섹션은 MSG와 후속 Step을 포함해 전체 제거한다", () => {
  const parseResult = {
    usage: {
      menuTitleBar: {
        hasInquiry: false,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [],
      },
      titleBars: [{
        title: "휴학신청정보",
        extButtons: [{ name: "파일선택", functionName: "UDC_BTN_UPLOAD" }],
      }],
    },
  };
  const usageText = `{B}파일선택{/B}
Step1. 파일을 선택합니다.
{MSG}파일을 선택해주십시오.{/MSG}
Step2. 결과를 확인합니다.

{B}휴학신청정보 - 파일선택{/B}
Step1. 파일을 선택합니다.`;

  assert.equal(
    removeDuplicateTitleBarUsageSections(usageText, parseResult),
    `{B}휴학신청정보 - 파일선택{/B}\nStep1. 파일을 선택합니다.`
  );
});

test("정규화된 타이틀바 섹션이 없으면 단독 섹션을 보존한다", () => {
  const parseResult = {
    usage: {
      menuTitleBar: {
        hasInquiry: false,
        hasNew: false,
        hasSave: false,
        hasDelete: false,
        extButtons: [],
      },
      titleBars: [{
        title: "휴학신청정보",
        extButtons: [{ name: "파일선택", functionName: "UDC_BTN_UPLOAD" }],
      }],
    },
  };
  const usageText = `{B}파일선택{/B}\nStep1. 파일을 선택합니다.`;

  assert.equal(removeDuplicateTitleBarUsageSections(usageText, parseResult), usageText);
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
