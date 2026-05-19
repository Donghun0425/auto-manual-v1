/**
 * 팝업 파서
 * - PatisUtils.openPopup 호출부에서 팝업 정보 추출
 */
import type { PopupInfo } from "@/types";

/**
 * openPopup 호출부에서 팝업 정보를 추출
 */
export function parsePopups(content: string): PopupInfo[] {
  const popups: PopupInfo[] = [];
  const seen = new Set<string>();

  const pattern =
    /PatisUtils\.openPopup\(\s*(?:["']([^"']+)["']|(\w+))\s*,\s*\w+\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const popupId = match[1] || match[2];
    const popupUrl = match[3];
    const callbackFunction = match[4];
    const width = parseInt(match[5]);
    const height = parseInt(match[6]);

    if (!seen.has(popupId)) {
      seen.add(popupId);
      popups.push({ popupId, popupUrl, callbackFunction, width, height });
    }
  }

  return popups;
}
