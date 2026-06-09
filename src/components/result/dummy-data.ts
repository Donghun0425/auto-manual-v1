import type { ManualResult } from "@/types";

export const DUMMY_PARSE_RESULT: ManualResult = {
  fileName: "SAM_학생등록관리.clx.js",
  filePath: "SAM/SAM_학생등록관리.clx.js",
  generatedAt: "2026-05-19T14:32:00.000Z",
  tokenUsage: { prompt_tokens: 820, completion_tokens: 420, total_tokens: 1240 },
  parseResult: {
    filePath: "SAM/SAM_학생등록관리.clx.js",
    overview: {
      systemName: "학사행정",
      subSystem: "학생관리",
      programName: "학생등록관리",
      appTitle: "학생등록관리",
      description: "학생의 기본정보를 등록·수정·삭제하는 화면입니다.",
      author: "홍길동",
      createDate: "2026-01-15",
    },
    usage: {
      menuTitleBar: {
        hasInquiry: true,
        hasNew: true,
        hasSave: true,
        hasDelete: true,
        extButtons: [
          { name: "엑셀다운로드", functionName: "Form_ext1Click", index: 1, description: "Step1. '엑셀다운로드' 버튼을 클릭하여 현재 목록을 엑셀 파일로 내보낸다." },
        ],
      },
      titleBars: [
        {
          hasInquiry: false,
          hasNew: false,
          hasSave: true,
          hasDelete: true,
          extButtons: [],
          title: "학생목록",
        },
      ],
      extraButtons: [],
    },
    notes: {
      requiredFields: [
        { targetId: "DG_GRID01", columns: ["STD_NM", "STD_NO"], texts: ["학생명", "학번"] },
      ],
      validations: [
        { functionName: "Form_saveAction", message: "학생명을 입력하세요." },
        { functionName: "Form_saveAction", message: "학번을 입력하세요." },
        { functionName: "fn_validate", message: "날짜 형식이 올바르지 않습니다." },
      ],
    },
    items: {
      conditionGroups: [
        {
          groupId: "SEARCHGROUP01",
          groupType: "조회조건",
          controls: [
            { controlId: "S_YR", labelText: "학년도", description: "", controlType: "PatisCombo", inputType: "입력" },
            { controlId: "S_SMSTR", labelText: "학기", description: "", controlType: "PatisCombo", inputType: "입력" },
            { controlId: "S_STD_NM", labelText: "학생명", description: "", controlType: "InputBox", inputType: "입력" },
          ],
        },
      ],
      infoGroups: [
        {
          groupId: "INFOGROUP01",
          title: "학생 상세정보",
          controls: [
            { controlId: "D_STD_NO", labelText: "학번", description: "", controlType: "InputBox", inputType: "표시" },
            { controlId: "D_STD_NM", labelText: "학생명", description: "", controlType: "InputBox", inputType: "입력" },
            { controlId: "D_DEPT", labelText: "학과", description: "", controlType: "PatisCombo", inputType: "입력" },
            { controlId: "D_BRDT", labelText: "생년월일", description: "", controlType: "InputBox", inputType: "입력" },
            { controlId: "D_STATUS", labelText: "재적상태", description: "", controlType: "PatisCombo", inputType: "입력" },
          ],
        },
      ],
      grids: [
        {
          gridId: "DG_GRID01",
          title: "학생목록",
          isBound: true,
          hasCheckbox: true,
          hasRowNumber: true,
          hasState: false,
          sortable: true,
          columns: [
            { columnName: "STD_NO", headerText: "학번", description: "", controlType: "Output", purpose: "표시" },
            { columnName: "STD_NM", headerText: "학생명", description: "", controlType: "Output", purpose: "표시" },
            { columnName: "DEPT_NM", headerText: "학과명", description: "", controlType: "Output", purpose: "표시" },
            { columnName: "GRADE", headerText: "학년", description: "", controlType: "Output", purpose: "표시" },
            { columnName: "STATUS_NM", headerText: "재적상태", description: "", controlType: "Output", purpose: "표시" },
          ],
        },
      ],
    },
    tabPages: [],
    popups: [
      { popupId: "pop_dept", popupUrl: "common/pop_dept", callbackFunction: "fn_deptCallback", width: 600, height: 500 },
    ],
    usedUdcs: [
      { shortName: "UcoYrSmstrCombo", qualifiedName: "udc.univ.UcoYrSmstrCombo", description: "년도/학기 콤보" },
      { shortName: "PatisCombo", qualifiedName: "udc.common.PatisCombo", description: "공통코드 콤보" },
    ],
  },
  htmlContent: `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>학생등록관리 매뉴얼</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.7; }
  h1 { border-bottom: 2px solid #2563eb; padding-bottom: 12px; color: #1e40af; }
  h2 { margin-top: 32px; color: #1d4ed8; font-size: 1.1rem; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 0.9rem; }
  th { background: #eff6ff; padding: 8px 12px; border: 1px solid #bfdbfe; text-align: left; }
  td { padding: 8px 12px; border: 1px solid #e2e8f0; }
  .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; font-weight: 600; }
</style>
</head>
<body>
<h1>📋 학생등록관리</h1>
<p>학생의 기본정보를 등록·수정·삭제하는 화면입니다.</p>
<p><strong>화면 ID:</strong> SAM_학생등록관리 &nbsp;|&nbsp; <strong>최종 수정:</strong> 2026-05-10</p>

<h2>🔍 검색 조건</h2>
<table><tr><th>항목명</th><th>컨트롤</th><th>기본값</th></tr>
<tr><td>학년도</td><td>ComboBox</td><td>2026</td></tr>
<tr><td>학기</td><td>ComboBox</td><td>1</td></tr>
<tr><td>학생명</td><td>Edit</td><td>-</td></tr>
</table>

<h2>📊 학생목록 그리드</h2>
<table><tr><th>컬럼</th><th>헤더</th><th>너비</th></tr>
<tr><td>studentNo</td><td>학번</td><td>100</td></tr>
<tr><td>studentNm</td><td>학생명</td><td>120</td></tr>
<tr><td>deptNm</td><td>학과명</td><td>160</td></tr>
<tr><td>grade</td><td>학년</td><td>60</td></tr>
<tr><td>statusNm</td><td>재적상태</td><td>100</td></tr>
</table>

<h2>✅ 필수값 검증</h2>
<table><tr><th>필드</th><th>타입</th><th>메시지</th></tr>
<tr><td>학생명</td><td><span class="badge">required</span></td><td>학생명을 입력하세요.</td></tr>
<tr><td>학번</td><td><span class="badge">required</span></td><td>학번을 입력하세요.</td></tr>
<tr><td>생년월일</td><td><span class="badge">format</span></td><td>날짜 형식이 올바르지 않습니다.</td></tr>
</table>
</body>
</html>`,
  markdownContent: `# 학생등록관리

> **화면 ID**: SAM_학생등록관리 | **최종 수정**: 2026-05-10

학생의 기본정보를 등록·수정·삭제하는 화면입니다.

---

## 📋 기능 개요

| 기능 | 함수명 | URL |
|------|--------|-----|
| 목록 조회 | \`fn_search\` | \`/sam/student/list\` |
| 신규 등록 | \`fn_insert\` | \`/sam/student/insert\` |
| 정보 수정 | \`fn_update\` | \`/sam/student/update\` |
| 정보 삭제 | \`fn_delete\` | \`/sam/student/delete\` |

## 🔍 검색 조건

| 항목명 | 컨트롤 | 기본값 |
|--------|--------|--------|
| 학년도 | ComboBox | 2026 |
| 학기 | ComboBox | 1 |
| 학생명 | Edit | - |

## 📊 학생목록 그리드

| 컬럼ID | 헤더 | 데이터 타입 | 너비 |
|--------|------|------------|------|
| studentNo | 학번 | string | 100 |
| studentNm | 학생명 | string | 120 |
| deptNm | 학과명 | string | 160 |
| grade | 학년 | number | 60 |
| statusNm | 재적상태 | string | 100 |

## ✅ 필수값 검증

| 필드명 | 타입 | 오류 메시지 |
|--------|------|------------|
| 학생명 | required | 학생명을 입력하세요. |
| 학번 | required | 학번을 입력하세요. |
| 생년월일 | format | 날짜 형식이 올바르지 않습니다. (YYYYMMDD) |

## 🪟 팝업

| 팝업 ID | 팝업명 | 트리거 |
|---------|--------|--------|
| pop_dept | 학과조회 팝업 | btn_deptSearch 클릭 |
`,
};

export const DUMMY_RESULTS: ManualResult[] = [
  DUMMY_PARSE_RESULT,
  {
    ...DUMMY_PARSE_RESULT,
    fileName: "FIN_수강료납부현황.clx.js",
    filePath: "FIN/FIN_수강료납부현황.clx.js",
    parseResult: {
      ...DUMMY_PARSE_RESULT.parseResult,
      filePath: "FIN/FIN_수강료납부현황.clx.js",
      overview: { systemName: "학사행정", subSystem: "수강관리", programName: "수강료납부현황", appTitle: "수강료납부현황", description: "학생별 수강료 납부 현황을 조회하는 화면입니다.", author: "", createDate: "" },
    },
    tokenUsage: { prompt_tokens: 550, completion_tokens: 430, total_tokens: 980 },
  },
];
