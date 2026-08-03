import { NextRequest, NextResponse } from "next/server";
import { parseUdcFile } from "@/lib/parser/udc-parser";
import {
  listUdcs,
  upsertUdcComponents,
  clearAllUdcs,
} from "@/lib/supabase/queries/udc";
import type { UdcComponentType, UdcCategory } from "@/types";
import { invalidateUdcContextCache } from "@/lib/ai/enrich-udc-context";

/** GET /api/udc — UDC 목록 조회 (검색·필터·페이지네이션) */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  try {
    const result = await listUdcs({
      search: sp.get("search") ?? "",
      componentType: (sp.get("type") as UdcComponentType | "all" | null) ?? "all",
      category: (sp.get("category") as UdcCategory | "all" | null) ?? "all",
      page: Number(sp.get("page") ?? "1"),
      pageSize: Number(sp.get("pageSize") ?? "20"),
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "UDC 목록 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface UploadBody {
  fileName: string;
  content: string;
  replaceAll?: boolean;
}

/** POST /api/udc — udc.js 업로드·파싱·업서트 */
export async function POST(request: NextRequest) {
  let body: UploadBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.content || typeof body.content !== "string") {
    return NextResponse.json({ error: "content 필드가 필요합니다." }, { status: 400 });
  }

  try {
    if (body.replaceAll) {
      await clearAllUdcs();
      invalidateUdcContextCache();
    }
    const parsed = parseUdcFile(body.fileName ?? "udc.js", body.content);
    const summary = await upsertUdcComponents(parsed);
    invalidateUdcContextCache(parsed.udcs.map((udc) => udc.component.short_name));
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "UDC 업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
