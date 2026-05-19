/**
 * 필수값 및 검증 로직 파서
 * - requiredColumn / requiredText 배열 추출
 * - alert 메시지 추출
 */
import type { RequiredFieldInfo, ValidationInfo } from "@/types";

/**
 * 필수값 정보(requiredColumn, requiredText) 추출
 */
export function parseRequiredFields(content: string): RequiredFieldInfo[] {
  const results: RequiredFieldInfo[] = [];

  const columnPattern =
    /PatisUtils\.setAppProperty\(app,\s*app\.lookup\("([^"]+)"\),\s*"requiredColumn",\s*new Array\(([^)]+)\)\)/g;
  const textPattern =
    /PatisUtils\.setAppProperty\(app,\s*app\.lookup\("([^"]+)"\),\s*"requiredText",\s*new Array\(([^)]+)\)\)/g;

  const columnMap = new Map<string, string[]>();
  let match: RegExpExecArray | null;

  while ((match = columnPattern.exec(content)) !== null) {
    const targetId = match[1];
    const columns = extractArrayValues(match[2]);
    columnMap.set(targetId, columns);
  }

  while ((match = textPattern.exec(content)) !== null) {
    const targetId = match[1];
    const texts = extractArrayValues(match[2]);
    const columns = columnMap.get(targetId) || [];
    results.push({ targetId, columns, texts });
  }

  return results;
}

/**
 * alert 메시지를 추출하여 검증 로직 목록 생성
 */
export function parseValidations(content: string): ValidationInfo[] {
  const results: ValidationInfo[] = [];
  const alertPattern = /alert\("([^"]+)"\)/g;
  let match: RegExpExecArray | null;

  while ((match = alertPattern.exec(content)) !== null) {
    const message = match[1];
    const functionName = findEnclosingFunction(content, match.index);
    results.push({ functionName, message });
  }

  return results;
}

function extractArrayValues(arrayStr: string): string[] {
  const values: string[] = [];
  const pattern = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(arrayStr)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function findEnclosingFunction(content: string, position: number): string {
  const before = content.substring(0, position);
  const funcPattern = /function\s+(\w+)\s*\(/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = funcPattern.exec(before)) !== null) {
    lastMatch = match;
  }
  return lastMatch ? lastMatch[1] : "unknown";
}
