import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseGrids } from "../src/lib/parser/gridParser.ts";

test("다단 병합 헤더를 상위-중간-하위 경로로 추출하고 colIndex 순서로 정렬한다", () => {
  const content = readFileSync("sample/ugr_3060404_u.clx.js", "utf8");

  const grid = parseGrids(content).find((item) => item.gridId === "DG_GRID01");
  assert.ok(grid);
  assert.equal(grid.columns.length, 44);

  assert.deepEqual(
    grid.columns.slice(9, 19).map((column) => column.columnName),
    [
      "CULT_ESNTL_ACQS_CRD",
      "CULT_CHC_ACQS_CRD",
      "CULT_ACQS_CRD",
      "CULT_RCG_CRD",
      "WHOL_CULT_CMCRS_CRD",
      "MJR_ESNTL_CRD",
      "MJR_CHC_CRD",
      "MJR_ACQS_CRD",
      "MJR_RCG_CRD",
      "WHOL_MJR_CMCRS_CRD",
    ],
  );

  const headerByColumn = new Map(grid.columns.map((column) => [column.columnName, column.headerText]));
  assert.equal(headerByColumn.get("CULT_ESNTL_ACQS_CRD"), "교양-취득-교필");
  assert.equal(headerByColumn.get("CULT_CHC_ACQS_CRD"), "교양-취득-교선");
  assert.equal(headerByColumn.get("CULT_ACQS_CRD"), "교양-취득-계");
  assert.equal(headerByColumn.get("MJR_ESNTL_CRD"), "전공-취득-전필");
  assert.equal(headerByColumn.get("MJR_CHC_CRD"), "전공-취득-전선");
  assert.equal(headerByColumn.get("REG_YR"), "현재상태-등록-년도");
  assert.equal(headerByColumn.get("REG_SMSTR_SE"), "현재상태-등록-학기");
  assert.equal(headerByColumn.get("SCSBJT_STND"), "석차정보-졸업 석차");
  assert.equal(headerByColumn.get("PERCN_SCR"), "석차정보-실점 평균");
});

test("동적 빈 헤더를 해석하고 하위 헤더 없는 병합 항목을 하나로 합친다", () => {
  const content = readFileSync("sample/aac_4040110_u.clx.js", "utf8");

  const grid = parseGrids(content).find((item) => item.gridId === "DG_GRID01");
  assert.ok(grid);

  const accountingColumn = grid.columns.find((column) => column.columnName === "USE_YN");
  assert.equal(accountingColumn?.headerText, "회계");

  const periodColumns = grid.columns.filter((column) => column.headerText === "기간");
  assert.equal(periodColumns.length, 1);
  assert.equal(periodColumns[0].columnName, "BGNG_YMD, BGNG_HR, END_YMD, END_HR");
  assert.equal(periodColumns[0].controlType, "DateInput / MaskEditor");
  assert.equal(periodColumns[0].purpose, "입력");
});
