import type { Dictionary, DictionaryCategory } from "@/types";

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

export const DUMMY_DICTIONARY: Dictionary[] = [
  { id: "1", term: "학번", category: "학사", description: "학생 고유 식별 번호입니다. 시스템 자동 부여됩니다.", source: "manual", user_id: "default", created_at: "2026-05-10T09:00:00Z", updated_at: "2026-05-10T09:00:00Z" },
  { id: "2", term: "재적상태", category: "학사", description: "학생의 현재 재적 상태입니다. (재학, 휴학, 제적, 졸업 등)", source: "manual", user_id: "default", created_at: "2026-05-10T09:01:00Z", updated_at: "2026-05-10T09:01:00Z" },
  { id: "3", term: "수강신청", category: "학사", description: "학생이 강의를 선택하여 수강 등록하는 절차입니다.", source: "ai", user_id: "default", created_at: "2026-05-11T10:00:00Z", updated_at: "2026-05-11T10:00:00Z" },
  { id: "4", term: "성적처리", category: "학사", description: "교수가 학기 종료 후 학생별 성적을 입력하고 확정하는 업무입니다.", source: "ai", user_id: "default", created_at: "2026-05-12T11:00:00Z", updated_at: "2026-05-12T11:00:00Z" },
  { id: "5", term: "공문서관리", category: "행정", description: "기관 내·외부로 발송되는 공식 문서를 등록·보관·조회하는 업무입니다.", source: "manual", user_id: "default", created_at: "2026-05-12T11:10:00Z", updated_at: "2026-05-12T11:10:00Z" },
  { id: "6", term: "인사발령", category: "행정", description: "직원의 부서 이동, 승진, 직급 변경 등을 처리하는 행정 업무입니다.", source: "manual", user_id: "default", created_at: "2026-05-13T14:00:00Z", updated_at: "2026-05-13T14:00:00Z" },
  { id: "7", term: "예산편성", category: "행정", description: "부서별 연간 예산을 계획하고 배정하는 업무입니다.", source: "ai", user_id: "default", created_at: "2026-05-13T14:05:00Z", updated_at: "2026-05-13T14:05:00Z" },
  { id: "8", term: "연구과제", category: "연구", description: "교내·외 연구비를 지원받아 수행하는 연구 프로젝트입니다.", source: "manual", user_id: "default", created_at: "2026-05-14T09:00:00Z", updated_at: "2026-05-14T09:00:00Z" },
  { id: "9", term: "연구비집행", category: "연구", description: "연구과제에 배정된 예산을 항목별로 사용하는 절차입니다.", source: "ai", user_id: "default", created_at: "2026-05-15T10:00:00Z", updated_at: "2026-05-15T10:00:00Z" },
  { id: "10", term: "부속기관", category: "부속", description: "대학 본부 산하 도서관, 병원, 연구소 등 부속 조직입니다.", source: "manual", user_id: "default", created_at: "2026-05-16T11:00:00Z", updated_at: "2026-05-16T11:00:00Z" },
  { id: "11", term: "공통코드", category: "공통", description: "시스템 전반에서 공유하는 코드 테이블입니다. (성별, 국적 등)", source: "manual", user_id: "default", created_at: "2026-05-16T11:05:00Z", updated_at: "2026-05-16T11:05:00Z" },
  { id: "12", term: "사용자권한", category: "공통", description: "시스템 메뉴 및 기능별 접근 권한을 사용자에게 부여하는 설정입니다.", source: "ai", user_id: "default", created_at: "2026-05-17T09:00:00Z", updated_at: "2026-05-17T09:00:00Z" },
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
