import { NextResponse } from "next/server";
import { getUdcDetail } from "@/lib/supabase/queries/udc";

/** GET /api/udc/[shortName] — UDC 단건 전체 상세 조회 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortName: string }> }
) {
  const { shortName } = await params;
  try {
    const detail = await getUdcDetail(shortName);
    if (!detail) {
      return NextResponse.json({ error: "UDC 를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "UDC 상세 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
