import { create } from "zustand";
import type { FileNode, FileTree, CheckState, UploadedFile } from "@/types";

/** 파일별 저장본 메타 (존재 여부 표시용) */
export interface SavedManualSummary {
  id: string;
  sourceHash: string;
  outputFormats: string[];
  generatedAt: string;
}

interface FileTreeState {
  tree: FileTree;
  uploadedFiles: UploadedFile[];
  /** 파일 경로별 "기존 저장본 재사용" 여부 */
  reuseByPath: Record<string, boolean>;
  /** 파일명별 DB 저장본 메타 (존재 여부/뱃지용) */
  savedByFileName: Record<string, SavedManualSummary>;

  // Actions
  setTree: (nodes: FileNode[]) => void;
  addFiles: (files: UploadedFile[], nodes: FileNode[]) => void;
  clearFiles: () => void;
  toggleCheck: (nodeId: string) => void;
  checkAll: () => void;
  uncheckAll: () => void;
  /** 체크된 파일을 트리/업로드 목록에서 제거하고 제거된 개수를 반환 */
  removeCheckedFiles: () => number;
  getSelectedFiles: () => UploadedFile[];
  setReuse: (path: string, reuse: boolean) => void;
  /** 저장본이 있는 파일들의 재사용 여부를 일괄 설정 (paths 미지정 시 전체 파일 대상) */
  setAllReuse: (reuse: boolean, paths?: string[]) => void;
  setSavedSummaries: (
    summaries: Array<{
      id: string;
      fileName: string;
      sourceHash: string;
      outputFormats: string[];
      generatedAt: string;
    }>
  ) => void;
}

function updateCheckState(nodes: FileNode[], targetId: string): FileNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      const newState: CheckState =
        node.checkState === "checked" ? "unchecked" : "checked";
      return applyCheckToSubtree(node, newState);
    }
    if (node.children) {
      const updatedChildren = updateCheckState(node.children, targetId);
      const parentState = deriveParentCheckState(updatedChildren);
      return { ...node, children: updatedChildren, checkState: parentState };
    }
    return node;
  });
}

function applyCheckToSubtree(node: FileNode, state: CheckState): FileNode {
  if (node.children) {
    return {
      ...node,
      checkState: state,
      children: node.children.map((child) =>
        applyCheckToSubtree(child, state)
      ),
    };
  }
  return { ...node, checkState: state };
}

function deriveParentCheckState(children: FileNode[]): CheckState {
  const allChecked = children.every((c) => c.checkState === "checked");
  const allUnchecked = children.every((c) => c.checkState === "unchecked");
  if (allChecked) return "checked";
  if (allUnchecked) return "unchecked";
  return "indeterminate";
}

function setAllCheckState(nodes: FileNode[], state: CheckState): FileNode[] {
  return nodes.map((node) => applyCheckToSubtree(node, state));
}

function countFiles(nodes: FileNode[]): number {
  return nodes.reduce((acc, node) => {
    if (node.type === "file") return acc + 1;
    if (node.children) return acc + countFiles(node.children);
    return acc;
  }, 0);
}

function countSelectedFiles(nodes: FileNode[]): number {
  return nodes.reduce((acc, node) => {
    if (node.type === "file" && node.checkState === "checked") return acc + 1;
    if (node.children) return acc + countSelectedFiles(node.children);
    return acc;
  }, 0);
}

function collectSelectedPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file" && node.checkState === "checked") {
      paths.push(node.path);
    }
    if (node.children) {
      paths.push(...collectSelectedPaths(node.children));
    }
  }
  return paths;
}

/** 체크된 파일 노드를 제거하고, 자식이 모두 사라진 폴더도 함께 제거 */
function removeCheckedNodes(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.checkState === "checked") continue; // 체크된 파일 제거
      result.push(node);
      continue;
    }
    // 폴더: 자식 정리 후 빈 폴더면 제거
    const children = node.children ? removeCheckedNodes(node.children) : [];
    if (children.length === 0) continue;
    result.push({
      ...node,
      children,
      checkState: deriveParentCheckState(children),
    });
  }
  return result;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  tree: { root: [], totalFiles: 0, selectedFiles: 0 },
  uploadedFiles: [],
  reuseByPath: {},
  savedByFileName: {},

  setTree: (nodes) =>
    set({
      tree: {
        root: nodes,
        totalFiles: countFiles(nodes),
        selectedFiles: countSelectedFiles(nodes),
      },
    }),

  addFiles: (files, nodes) =>
    set((state) => {
      const newRoot = [...state.tree.root, ...nodes];
      return {
        uploadedFiles: [...state.uploadedFiles, ...files],
        tree: {
          root: newRoot,
          totalFiles: countFiles(newRoot),
          selectedFiles: countSelectedFiles(newRoot),
        },
      };
    }),

  clearFiles: () =>
    set({
      tree: { root: [], totalFiles: 0, selectedFiles: 0 },
      uploadedFiles: [],
      reuseByPath: {},
      savedByFileName: {},
    }),

  toggleCheck: (nodeId) =>
    set((state) => {
      const newRoot = updateCheckState(state.tree.root, nodeId);
      return {
        tree: {
          root: newRoot,
          totalFiles: state.tree.totalFiles,
          selectedFiles: countSelectedFiles(newRoot),
        },
      };
    }),

  checkAll: () =>
    set((state) => {
      const newRoot = setAllCheckState(state.tree.root, "checked");
      return {
        tree: {
          root: newRoot,
          totalFiles: state.tree.totalFiles,
          selectedFiles: countFiles(newRoot),
        },
      };
    }),

  uncheckAll: () =>
    set((state) => ({
      tree: {
        root: setAllCheckState(state.tree.root, "unchecked"),
        totalFiles: state.tree.totalFiles,
        selectedFiles: 0,
      },
    })),

  removeCheckedFiles: () => {
    const state = get();
    const removedPaths = new Set(collectSelectedPaths(state.tree.root));
    if (removedPaths.size === 0) return 0;

    const newRoot = removeCheckedNodes(state.tree.root);
    const reuseByPath = { ...state.reuseByPath };
    for (const p of removedPaths) delete reuseByPath[p];

    set({
      tree: {
        root: newRoot,
        totalFiles: countFiles(newRoot),
        selectedFiles: countSelectedFiles(newRoot),
      },
      uploadedFiles: state.uploadedFiles.filter((f) => !removedPaths.has(f.path)),
      reuseByPath,
    });
    return removedPaths.size;
  },

  getSelectedFiles: () => {
    const state = get();
    const selectedPaths = collectSelectedPaths(state.tree.root);
    return state.uploadedFiles.filter((f) => selectedPaths.includes(f.path));
  },

  setReuse: (path, reuse) =>
    set((state) => ({
      reuseByPath: { ...state.reuseByPath, [path]: reuse },
    })),

  setAllReuse: (reuse, paths) =>
    set((state) => {
      const targetSet = paths ? new Set(paths) : null;
      const reuseByPath = { ...state.reuseByPath };
      for (const f of state.uploadedFiles) {
        if (targetSet && !targetSet.has(f.path)) continue;
        // 저장본이 있는 파일만 토글 대상 (나머지는 항상 새로 생성)
        if (state.savedByFileName[f.name]) {
          reuseByPath[f.path] = reuse;
        }
      }
      return { reuseByPath };
    }),

  setSavedSummaries: (summaries) =>
    set((state) => {
      const savedByFileName: Record<string, SavedManualSummary> = {};
      for (const s of summaries) {
        savedByFileName[s.fileName] = {
          id: s.id,
          sourceHash: s.sourceHash,
          outputFormats: s.outputFormats,
          generatedAt: s.generatedAt,
        };
      }
      // 저장본이 있는 파일은 기본적으로 재사용 ON (사용자가 미지정한 경우만)
      const reuseByPath = { ...state.reuseByPath };
      for (const f of state.uploadedFiles) {
        if (savedByFileName[f.name] && reuseByPath[f.path] === undefined) {
          reuseByPath[f.path] = true;
        }
      }
      return { savedByFileName, reuseByPath };
    }),
}));
