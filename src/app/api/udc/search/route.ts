import { NextRequest, NextResponse } from "next/server";
import { searchUdcs } from "@/lib/supabase/queries/udc";

/** GET /api/udc/search?q=키워드 — UDC 이름·설명 부분일치 검색 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  try {
    const data = await searchUdcs(q, limit);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UDC 검색 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
