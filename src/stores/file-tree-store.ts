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
  getSelectedFiles: () => UploadedFile[];
  setReuse: (path: string, reuse: boolean) => void;
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

  getSelectedFiles: () => {
    const state = get();
    const selectedPaths = collectSelectedPaths(state.tree.root);
    return state.uploadedFiles.filter((f) => selectedPaths.includes(f.path));
  },

  setReuse: (path, reuse) =>
    set((state) => ({
      reuseByPath: { ...state.reuseByPath, [path]: reuse },
    })),

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
