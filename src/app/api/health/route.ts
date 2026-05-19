import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

/**
 * GET /api/health
 * Supabase 연결 상태 및 3개 테이블 존재 여부를 확인합니다.
 */
export async function GET() {
  const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};

  const tables = ["dictionary", "layout_template", "generation_log"] as const;

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      results[table] = { ok: false, error: error.message };
    } else {
      results[table] = { ok: true, count: count ?? 0 };
    }
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "error",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/https:\/\/(.{6}).*/, "https://$1...")
        : "미설정",
      tables: results,
    },
    { status: allOk ? 200 : 500 }
  );
}
