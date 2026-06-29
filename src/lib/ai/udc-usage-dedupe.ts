import type { ClxParseResult } from "@/types";

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s*[-–]\s*/g, " - ");
}

/**
 * AI가 UDC 버튼을 실제 소유 타이틀바 외의 타이틀바에도 반복 생성한 경우,
 * 올바른 소유 섹션이 존재할 때에만 잘못 복제된 섹션을 제거한다.
 */
export function removeDuplicateUdcUsageSections(
  usageText: string,
  parseResult: ClxParseResult
): string {
  const ownersByButton = new Map<string, Set<string>>();

  for (const titleBar of parseResult.usage.titleBars) {
    const title = titleBar.title || "상세 정보";
    for (const button of titleBar.extButtons) {
      if (!button.functionName.startsWith("UDC_")) continue;
      const owners = ownersByButton.get(button.name) ?? new Set<string>();
      owners.add(normalizeTitle(`${title} - ${button.name}`));
      ownersByButton.set(button.name, owners);
    }
  }
  if (ownersByButton.size === 0) return usageText;

  const lines = usageText.split("\n");
  const headings = new Set(
    lines
      .map((line) => /^\{B\}(.+?)\{\/B\}$/.exec(line.trim())?.[1])
      .filter((title): title is string => Boolean(title))
      .map(normalizeTitle)
  );

  const removableTitles = new Set<string>();
  for (const [buttonName, owners] of ownersByButton) {
    // 올바른 소유 섹션이 누락된 경우에는 유일한 안내까지 지우지 않는다.
    if (![...owners].some((owner) => headings.has(owner))) continue;
    const suffix = normalizeTitle(`x - ${buttonName}`).slice(1);
    for (const heading of headings) {
      if (heading.endsWith(suffix) && !owners.has(heading)) {
        removableTitles.add(heading);
      }
    }
  }
  if (removableTitles.size === 0) return usageText;

  const result: string[] = [];
  let skipSection = false;
  for (const line of lines) {
    const section = /^\{B\}(.+?)\{\/B\}$/.exec(line.trim());
    if (section) {
      skipSection = removableTitles.has(normalizeTitle(section[1]));
    }
    if (!skipSection) result.push(line);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
