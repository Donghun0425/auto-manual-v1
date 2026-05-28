/**
 * 매뉴얼 생성 결과를 서버 측에서 임시 캐싱하는 API 라우트
 * Playwright 스크립트가 이 엔드포인트를 통해 실제 결과 데이터를 조회합니다.
 */

import { NextResponse } from "next/server";

// 모듈 레벨 서버사이드 캐시 (개발 서버가 실행 중인 동안 유지)
let cachedResult: unknown = null;

export async function GET() {
  return NextResponse.json({ result: cachedResult });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    cachedResult = body.result ?? null;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
