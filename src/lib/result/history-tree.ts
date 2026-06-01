/**
 * 히스토리 페이지용 디렉토리 트리 모델.
 * 파일명에서 디렉토리 경로를 추출하여 계층 구조를 구성한다.
 *
 * 추출 규칙 (예: ahm_4010301_t10)
 *  - 1단계: 접두사     → "ahm"
 *  - 2단계: 접두사 + 숫자부 4~5번째 문자 → "ahm" + "03" = "ahm03"
 *  - 파일: 전체 파일명
 */

/** 트리 내 파일(리프) */
export interface HistoryFileLeaf {
  /** results 배열 내 인덱스 */
  index: number;
  fileName: string;
  tokens?: number;
}

/** 트리 디렉토리 노드 */
export interface HistoryDirNode {
  /** 세그먼트 라벨 (예: "ahm", "ahm03") */
  name: string;
  /** 루트부터의 전체 경로 (정렬·키용) */
  path: string;
  dirs: HistoryDirNode[];
  files: HistoryFileLeaf[];
}

/** 파일명에서 확장자(.clx.js 또는 일반 확장자) 제거한 기본명 */
export function baseFileName(fileName: string): string {
  return fileName.replace(/\.clx\.js$/i, "").replace(/\.[^.]+$/, "");
}

/**
 * 파일명에서 디렉토리 세그먼트 배열을 추출한다.
 * 규칙에 맞지 않으면 ["기타"] 로 분류한다.
 */
export function extractDirSegments(fileName: string): string[] {
  const base = baseFileName(fileName);
  // <접두사 알파벳>_<숫자 4자리 이상>...
  const m = base.match(/^([A-Za-z]+)_(\d{4,})/);
  if (!m) return ["기타"];
  const prefix = m[1];
  const num = m[2];
  // 숫자부 4~5번째 문자 (1-based) = slice(3, 5)
  const mid = num.slice(3, 5);
  const seg2 = mid ? `${prefix}${mid}` : prefix;
  return [prefix, seg2];
}

/** 디렉토리 노드 찾기/생성 */
function ensureDir(parent: HistoryDirNode, name: string): HistoryDirNode {
  let dir = parent.dirs.find((d) => d.name === name);
  if (!dir) {
    dir = {
      name,
      path: parent.path ? `${parent.path}/${name}` : name,
      dirs: [],
      files: [],
    };
    parent.dirs.push(dir);
  }
  return dir;
}

/** 디렉토리 경로 순으로 재귀 정렬 */
function sortDir(node: HistoryDirNode): void {
  node.dirs.sort((a, b) => a.path.localeCompare(b.path, "ko"));
  node.files.sort((a, b) => a.fileName.localeCompare(b.fileName, "ko"));
  node.dirs.forEach(sortDir);
}

/**
 * 파일 목록으로 디렉토리 트리를 구성한다.
 * 디렉토리·파일 모두 경로/이름 순으로 정렬된다.
 */
export function buildHistoryTree(
  items: { fileName: string; index: number; tokens?: number }[]
): HistoryDirNode {
  const root: HistoryDirNode = { name: "", path: "", dirs: [], files: [] };

  for (const item of items) {
    const segments = extractDirSegments(item.fileName);
    let cursor = root;
    for (const seg of segments) {
      cursor = ensureDir(cursor, seg);
    }
    cursor.files.push({
      index: item.index,
      fileName: item.fileName,
      tokens: item.tokens,
    });
  }

  sortDir(root);
  return root;
}

/** 트리 내 모든 디렉토리 경로 수집 (기본 펼침용) */
export function collectDirPaths(node: HistoryDirNode): string[] {
  const paths: string[] = [];
  for (const dir of node.dirs) {
    paths.push(dir.path);
    paths.push(...collectDirPaths(dir));
  }
  return paths;
}
