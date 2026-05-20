import type { Dictionary, DictionaryCategory, DictionaryContextType } from "@/types";

export const CATEGORY_LABELS: Record<DictionaryCategory, string> = {
  공통: "공통",
  학사: "학사",
  행정: "행정",
  연구: "연구",
  부속: "부속",
  기타: "기타",
};

export const CATEGORY_COLORS: Record<DictionaryCategory, string> = {
  공통: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  학사: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  행정: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  연구: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  부속: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  기타: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
};

export const CONTEXT_TYPE_LABELS: Record<DictionaryContextType, string> = {
  조회조건: "조회조건",
  그리드: "그리드",
  처리조건: "처리조건",
  인포영역: "인폼영역",
};

export const DUMMY_DICTIONARY: Dictionary[] = [
  { term: "학번", context_type: "그리드", category: "학사", description: "학생 고유 식별 번호입니다. 시스템 자동 부여됩니다.", source: "manual", user_id: "default", created_at: "2026-05-10T09:00:00Z", updated_at: "2026-05-10T09:00:00Z" },
  { term: "학번", context_type: "조회조건", category: "학사", description: "조회할 학생의 학번을 입력하는 검색 조건입니다.", source: "manual", user_id: "default", created_at: "2026-05-10T09:00:00Z", updated_at: "2026-05-10T09:00:00Z" },
  { term: "재적상태", context_type: "그리드", category: "학사", description: "학생의 현재 재적 상태입니다. (재학, 휴학, 제적, 졸업 등)", source: "manual", user_id: "default", created_at: "2026-05-10T09:01:00Z", updated_at: "2026-05-10T09:01:00Z" },
  { term: "수강신청", context_type: "처리조건", category: "학사", description: "수강신청 여부를 기준으로 처리할 대상을 선택하는 조건입니다.", source: "ai", user_id: "default", created_at: "2026-05-11T10:00:00Z", updated_at: "2026-05-11T10:00:00Z" },
  { term: "성적처리", context_type: "그리드", category: "학사", description: "교수가 학기 종료 후 학생별 성적을 입력하고 확정하는 업무입니다.", source: "ai", user_id: "default", created_at: "2026-05-12T11:00:00Z", updated_at: "2026-05-12T11:00:00Z" },
  { term: "공문서관리", context_type: "인포영역", category: "행정", description: "기관 내·외부로 발송되는 공식 문서를 등록·보관·조회하는 업무입니다.", source: "manual", user_id: "default", created_at: "2026-05-12T11:10:00Z", updated_at: "2026-05-12T11:10:00Z" },
  { term: "인사발령", context_type: "그리드", category: "행정", description: "직원의 부서 이동, 승진, 직급 변경 등을 처리하는 행정 업무입니다.", source: "manual", user_id: "default", created_at: "2026-05-13T14:00:00Z", updated_at: "2026-05-13T14:00:00Z" },
  { term: "예산편성", context_type: "처리조건", category: "행정", description: "예산편성 대상 부서를 선택하는 처리 조건입니다.", source: "ai", user_id: "default", created_at: "2026-05-13T14:05:00Z", updated_at: "2026-05-13T14:05:00Z" },
  { term: "연구과제", context_type: "그리드", category: "연구", description: "교내·외 연구비를 지원받아 수행하는 연구 프로젝트입니다.", source: "manual", user_id: "default", created_at: "2026-05-14T09:00:00Z", updated_at: "2026-05-14T09:00:00Z" },
  { term: "연구비집행", context_type: "그리드", category: "연구", description: "연구과제에 배정된 예산을 항목별로 사용하는 절차입니다.", source: "ai", user_id: "default", created_at: "2026-05-15T10:00:00Z", updated_at: "2026-05-15T10:00:00Z" },
  { term: "부속기관", context_type: "인포영역", category: "부속", description: "대학 본부 산하 도서관, 병원, 연구소 등 부속 조직입니다.", source: "manual", user_id: "default", created_at: "2026-05-16T11:00:00Z", updated_at: "2026-05-16T11:00:00Z" },
  { term: "공통코드", context_type: "그리드", category: "공통", description: "시스템 전반에서 공유하는 코드 테이블입니다. (성별, 국적 등)", source: "manual", user_id: "default", created_at: "2026-05-16T11:05:00Z", updated_at: "2026-05-16T11:05:00Z" },
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
