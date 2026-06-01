import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * 싱글턴 Supabase 클라이언트 (브라우저 / 서버 공용)
 *
 * 제네릭 타입 대신 각 쿼리 함수에서 반환 타입을 명시합니다.
 * 환경변수 미설정 시 쿼리 호출 시점에 Supabase SDK 내부에서 오류가 발생합니다.
 * 실행 전 .env.local.example 을 참고하여 .env.local 파일을 생성하세요.
 */
// 환경변수 미설정 시 모듈 초기화 크래시를 방지하기 위해 placeholder 사용
// 실제 요청 시 오류가 발생하며, page.tsx 등에서 try-catch로 처리됨
export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      persistSession: false,
    },
  }
);
