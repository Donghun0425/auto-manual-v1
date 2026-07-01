import type { ClxParseResult } from "@/types";

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s*[-–]\s*/g, " - ");
}

interface UsageSection {
  title?: string;
  lines: string[];
}

/** {B}소제목{/B}부터 다음 소제목 직전까지를 하나의 사용방법 섹션으로 묶는다. */
function splitUsageSections(usageText: string): UsageSection[] {
  const sections: UsageSection[] = [];
  let current: UsageSection = { lines: [] };

  for (const line of usageText.split("\n")) {
    const heading = /^\{B\}(.+?)\{\/B\}$/.exec(line.trim());
    if (heading) {
      if (current.lines.length > 0) sections.push(current);
      current = {
        title: normalizeTitle(heading[1]),
        lines: [line],
      };
      continue;
    }
    current.lines.push(line);
  }

  if (current.lines.length > 0) sections.push(current);
  return sections;
}

/**
 * 타이틀바 버튼이 "{타이틀바} - {버튼}" 형식과 단독 형식으로 모두 생성된 경우
 * 진짜 중복 단독 섹션만 제거한다. 메뉴의 CRUD/확장 버튼은 동일한 이름이어도
 * 별개의 정상 기능이므로 보존한다.
 */
export function removeDuplicateTitleBarUsageSections(
  usageText: string,
  parseResult: ClxParseResult
): string {
  const sections = splitUsageSections(usageText);
  const presentTitles = new Set(
    sections.flatMap((section) => section.title ? [section.title] : [])
  );

  const menu = parseResult.usage.menuTitleBar;
  const protectedStandaloneTitles = new Set<string>();
  if (menu.hasInquiry) protectedStandaloneTitles.add(normalizeTitle("조회"));
  if (menu.hasNew) protectedStandaloneTitles.add(normalizeTitle("신규"));
  if (menu.hasSave) protectedStandaloneTitles.add(normalizeTitle("저장"));
  if (menu.hasDelete) protectedStandaloneTitles.add(normalizeTitle("삭제"));
  for (const button of menu.extButtons) {
    protectedStandaloneTitles.add(normalizeTitle(button.name));
  }

  const removableStandaloneTitles = new Set<string>();
  for (const titleBar of parseResult.usage.titleBars) {
    const title = titleBar.title || "상세 정보";
    for (const button of titleBar.extButtons) {
      const standaloneTitle = normalizeTitle(button.name);
      const qualifiedTitle = normalizeTitle(`${title} - ${button.name}`);
      if (
        presentTitles.has(qualifiedTitle)
        && !protectedStandaloneTitles.has(standaloneTitle)
      ) {
        removableStandaloneTitles.add(standaloneTitle);
      }
    }
  }

  if (removableStandaloneTitles.size === 0) return usageText;

  return sections
    .filter((section) => !section.title || !removableStandaloneTitles.has(section.title))
    .flatMap((section) => section.lines)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
