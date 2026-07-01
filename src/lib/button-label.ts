/**
 * 프레임워크 주석에서 유래한 기술적 버튼명을 사용자용 라벨로 변환한다.
 * 일반 버튼명의 대괄호는 보존하고 Patis 타이틀바 접두사가 명시된 형식만 다룬다.
 */
export function normalizeFrameworkButtonLabel(label: string): string {
  const trimmed = label.trim();
  const match = /^(?:PatisMenuTitleBar|PatisTitleBar)(?:\s+추가버튼\d+)?\s*\[\s*([^\]]+?)\s*\]$/i.exec(trimmed);
  return match?.[1].trim() || trimmed;
}

/** 버튼명을 AI 응답·사용방법 제목 비교용 키로 변환한다. */
export function buttonLabelKey(label: string): string {
  return normalizeFrameworkButtonLabel(label).replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * AI가 버튼명을 기술적 접두사 없이 반환해도 원본 버튼을 안전하게 찾는다.
 * 완전 일치를 우선하고, 정규화 후 후보가 하나일 때만 매칭한다.
 */
export function findButtonByLabel<T extends { name: string }>(
  buttons: T[],
  responseName: string
): T | undefined {
  const exact = buttons.find((button) => button.name === responseName);
  if (exact) return exact;

  const key = buttonLabelKey(responseName);
  const candidates = buttons.filter((button) => buttonLabelKey(button.name) === key);
  return candidates.length === 1 ? candidates[0] : undefined;
}
