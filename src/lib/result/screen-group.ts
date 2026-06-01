/**
 * 화면 그룹 모델
 *
 * 한 번에 생성된 매뉴얼 결과(ManualResult[])에서, 메인 화면(_u)과 그 화면이
 * 로드하는 탭페이지(_tNN)·팝업(_pNN)을 명명 규칙과 파싱된 tabPages/popups 로
 * 묶어 계층 구조로 만든다. 결과 페이지의 계층형 사이드바와 상호 이동 링크에 사용.
 *
 * 명명 규칙: {base}_u(메인) / {base}_tNN(탭) / {base}_pNN(팝업)
 *   예) usc_3010501_u, usc_3010501_t01, usc_3010501_p01 → groupKey "usc_3010501"
 */
import type { ManualResult } from "@/types";

export type ScreenRole = "main" | "tab" | "popup";

/** 그룹 내 자식(탭/팝업) 노드 */
export interface ScreenGroupChild {
  index: number;
  role: "tab" | "popup";
  label: string;
  fileName: string;
}

/** 사이드바 렌더링용 그룹 뷰 */
export interface ScreenGroupView {
  groupKey: string;
  mainIndex: number | null;
  mainLabel: string;
  mainFileName: string;
  tabs: ScreenGroupChild[];
  popups: ScreenGroupChild[];
}

/** 화면 그룹 모델 + 탐색 헬퍼 */
export interface ScreenGroupModel {
  groups: ScreenGroupView[];
  /** appUri/popupUrl(또는 파일경로)를 결과 인덱스로 해석 (없으면 undefined) */
  resolveIndexByUri: (uri: string) => number | undefined;
  /** 자식(탭/팝업) 인덱스 → 메인 인덱스 */
  getParentIndex: (index: number) => number | undefined;
  /** 결과 인덱스의 역할 */
  getRole: (index: number) => ScreenRole;
}

/** 경로/URI 에서 파일 기본명 추출 (디렉터리·확장자 제거) */
export function baseNameOf(pathOrUri: string): string {
  const seg = pathOrUri.replace(/\\/g, "/").split("/").pop() ?? pathOrUri;
  return seg.replace(/\.clx\.js$/i, "").replace(/\.js$/i, "");
}

function roleOf(base: string): ScreenRole {
  if (/_t\d+$/i.test(base)) return "tab";
  if (/_p\d+$/i.test(base)) return "popup";
  return "main";
}

function groupKeyOf(base: string): string {
  return base.replace(/_(u|t\d+|p\d+)$/i, "");
}

function programNameOf(result: ManualResult): string {
  return result.parseResult.overview.programName?.trim() || result.fileName;
}

/**
 * 결과 배열로부터 화면 그룹 모델을 구성한다.
 */
export function buildScreenGroups(results: ManualResult[]): ScreenGroupModel {
  const metas = results.map((r) => {
    const base = baseNameOf(r.filePath || r.fileName);
    return { base, role: roleOf(base), groupKey: groupKeyOf(base) };
  });

  // 파일 기본명 → 인덱스 (상호 링크 해석용)
  const indexByBase = new Map<string, number>();
  metas.forEach((m, i) => {
    if (!indexByBase.has(m.base)) indexByBase.set(m.base, i);
  });

  // groupKey → 멤버 인덱스
  const groupMembers = new Map<string, number[]>();
  metas.forEach((m, i) => {
    const arr = groupMembers.get(m.groupKey) ?? [];
    arr.push(i);
    groupMembers.set(m.groupKey, arr);
  });

  const parentByChild = new Map<number, number>();
  const groups: ScreenGroupView[] = [];

  for (const [groupKey, members] of groupMembers) {
    const mainIdx = members.find((i) => metas[i].role === "main") ?? null;

    // 메인의 tabPages 로 탭 라벨 매핑
    const tabLabelByBase = new Map<string, string>();
    if (mainIdx !== null) {
      for (const tp of results[mainIdx].parseResult.tabPages) {
        if (tp.tabLabel) tabLabelByBase.set(baseNameOf(tp.appUri), tp.tabLabel);
      }
    }

    const tabs: ScreenGroupChild[] = [];
    const popups: ScreenGroupChild[] = [];
    for (const i of members) {
      if (i === mainIdx) continue;
      const meta = metas[i];
      if (meta.role === "main") continue; // 그룹 내 또 다른 독립 화면은 건드리지 않음
      if (mainIdx !== null) parentByChild.set(i, mainIdx);
      const child: ScreenGroupChild = {
        index: i,
        role: meta.role,
        fileName: results[i].fileName,
        label: tabLabelByBase.get(meta.base) || programNameOf(results[i]),
      };
      (meta.role === "tab" ? tabs : popups).push(child);
    }

    tabs.sort((a, b) => a.fileName.localeCompare(b.fileName));
    popups.sort((a, b) => a.fileName.localeCompare(b.fileName));

    groups.push({
      groupKey,
      mainIndex: mainIdx,
      mainLabel: mainIdx !== null ? programNameOf(results[mainIdx]) : groupKey,
      mainFileName: mainIdx !== null ? results[mainIdx].fileName : groupKey,
      tabs,
      popups,
    });
  }

  // 원본 결과 순서를 따르도록 그룹 정렬 (각 그룹의 최소 멤버 인덱스 기준)
  groups.sort((a, b) => {
    const am = Math.min(...(groupMembers.get(a.groupKey) ?? [0]));
    const bm = Math.min(...(groupMembers.get(b.groupKey) ?? [0]));
    return am - bm;
  });

  return {
    groups,
    resolveIndexByUri: (uri: string) => indexByBase.get(baseNameOf(uri)),
    getParentIndex: (index: number) => parentByChild.get(index),
    getRole: (index: number) => metas[index]?.role ?? "main",
  };
}
