import type { UdcComponentType, UdcCategory } from "@/types";

/** 컴포넌트 타입 한글 라벨 */
export const UDC_TYPE_LABELS: Record<UdcComponentType, string> = {
  combo: "콤보",
  cascading_combo: "연계 콤보",
  grid: "그리드",
  info: "인포",
  file_upload: "파일 업로드",
  button_bar: "버튼바",
  utility: "유틸리티",
  editor: "에디터",
  report: "리포트",
  finder: "검색기",
};

/** 컴포넌트 타입 색상 */
export const UDC_TYPE_COLORS: Record<UdcComponentType, string> = {
  combo: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cascading_combo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  grid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  info: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  file_upload: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  button_bar: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  utility: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  editor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  report: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  finder: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

/** 카테고리 한글 라벨 (단어사전과 동일) */
export const UDC_CATEGORY_LABELS: Record<UdcCategory, string> = {
  공통: "공통",
  학사: "학사",
  행정: "행정",
  연구: "연구",
  부속: "부속",
  기타: "기타",
};

export const UDC_TYPE_OPTIONS: (UdcComponentType | "all")[] = [
  "all",
  "combo",
  "cascading_combo",
  "grid",
  "info",
  "file_upload",
  "button_bar",
  "utility",
];

export const UDC_CATEGORY_OPTIONS: (UdcCategory | "all")[] = [
  "all",
  "공통",
  "학사",
  "행정",
  "연구",
  "부속",
  "기타",
];

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type UdcPageSize = (typeof PAGE_SIZE_OPTIONS)[number];
