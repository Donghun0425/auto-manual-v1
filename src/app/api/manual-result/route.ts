import { NextRequest, NextResponse } from "next/server";
import {
  getManualResultById,
  findManualResultsByFileNames,
  listAllManualResults,
  rowToManualResult,
  type ManualResultSummary,
} from "@/lib/supabase/queries/manual-result";
import type { ManualResult } from "@/types";

/**
 * GET /api/manual-result
 *  - ?id=<uuid>            : 단일 저장본 전체 조회 (히스토리 불러오기)
 *  - ?fileNames=a,b,c      : 여러 파일명의 저장본 메타 조회 (UI 뱃지/존재 여부)
 *  - ?list=full            : 전체 저장본 조회 (히스토리 페이지, parse_result 포함)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const fileNamesParam = searchParams.get("fileNames");
  const list = searchParams.get("list");

  try {
    if (list === "full") {
      const rows = await listAllManualResults();
      const results: ManualResult[] = rows.map(rowToManualResult);
      return NextResponse.json({ results });
    }

    if (id) {
      const row = await getManualResultById(id);
      if (!row) {
        return NextResponse.json({ error: "저장본을 찾을 수 없습니다." }, { status: 404 });
      }
      const result: ManualResult = rowToManualResult(row);
      return NextResponse.json({ result });
    }

    if (fileNamesParam !== null) {
      const fileNames = fileNamesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const summaries: ManualResultSummary[] = await findManualResultsByFileNames(fileNames);
      return NextResponse.json({ summaries });
    }

    return NextResponse.json({ error: "id 또는 fileNames 파라미터가 필요합니다." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "조회 실패" },
      { status: 500 }
    );
  }
}
