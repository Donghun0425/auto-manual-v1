import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * CLX 파서에서 추출한 라벨 텍스트를 정규화한다.
 * - JS 문자열 이스케이프 시퀀스(\r\n, \n, \r, \t)를 공백으로 치환
 * - 유니코드 이스케이프(\uXXXX)를 완전 제거
 * - 연속 공백을 단일 공백으로 축소
 */
export function normalizeLabel(str: string): string {
  return str
    .replace(/\\r\\n|\\r|\\n/g, ' ')
    .replace(/\\u[0-9a-fA-F]{4}/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
