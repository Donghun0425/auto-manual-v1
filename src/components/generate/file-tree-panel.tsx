"use client";

import { useState } from "react";
import { FileCode2, Folder, FolderOpen, Minus, Square, CheckSquare, Database, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFileTreeStore } from "@/stores/file-tree-store";
import type { FileNode, CheckState } from "@/types";

// ── 개별 체크박스 아이콘 ──────────────────────────────────────
function CheckIcon({ state }: { state: CheckState }) {
  if (state === "checked")
    return <CheckSquare className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
  if (state === "indeterminate")
    return <Minus className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
  return <Square className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />;
}

// ── 저장본 재사용/새로생성 토글 ───────────────────────────────
function ReuseToggle({ node }: { node: FileNode }) {
  const saved = useFileTreeStore((s) => s.savedByFileName[node.name]);
  const reuse = useFileTreeStore((s) => s.reuseByPath[node.path]);
  const setReuse = useFileTreeStore((s) => s.setReuse);

  if (!saved) return null; // 저장본 없으면 토글 숨김 (항상 새로 생성)

  const isReuse = reuse !== false; // 저장본 있으면 기본 재사용
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setReuse(node.path, !isReuse);
      }}
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0 border transition-colors",
        isReuse
          ? "text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950"
          : "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950"
      )}
      title={isReuse ? "기존 저장본을 재사용합니다 (클릭 시 새로 생성)" : "새로 생성합니다 (클릭 시 저장본 재사용)"}
      aria-label={`${node.name} ${isReuse ? "재사용" : "새로 생성"}`}
    >
      {isReuse ? (
        <>
          <Database className="h-3 w-3" aria-hidden="true" />
          재사용
        </>
      ) : (
        <>
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          새로 생성
        </>
      )}
    </button>
  );
}

// ── 저장본 일괄 재사용/새로생성 토글 ──────────────────────────
function BulkReuseToggle() {
  const uploadedFiles = useFileTreeStore((s) => s.uploadedFiles);
  const savedByFileName = useFileTreeStore((s) => s.savedByFileName);
  const setAllReuse = useFileTreeStore((s) => s.setAllReuse);
  const getSelectedFiles = useFileTreeStore((s) => s.getSelectedFiles);

  // 저장본이 있는 파일 수 (토글 대상)
  const savedCount = uploadedFiles.filter((f) => savedByFileName[f.name]).length;
  if (savedCount === 0) return null; // 저장본 없으면 일괄 토글 숨김

  function applyAll(reuse: boolean) {
    const selected = getSelectedFiles();
    // 체크된 파일이 있으면 그 파일만, 없으면 전체 대상
    const paths = selected.length > 0 ? selected.map((f) => f.path) : undefined;
    setAllReuse(reuse, paths);
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs text-muted-foreground">저장본 일괄:</span>
      <button
        type="button"
        onClick={() => applyAll(true)}
        className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium text-green-700 border-green-300 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900 transition-colors"
        title="저장본이 있는 파일을 모두 재사용으로 설정"
      >
        <Database className="h-3 w-3" aria-hidden="true" />
        전체 재사용
      </button>
      <button
        type="button"
        onClick={() => applyAll(false)}
        className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 transition-colors"
        title="저장본이 있는 파일을 모두 새로 생성으로 설정"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        전체 새로생성
      </button>
    </div>
  );
}

// ── 재귀 트리 노드 ────────────────────────────────────────────
interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expandedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

function TreeNode({ node, depth, expandedIds, onToggleCheck, onToggleExpand }: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted/50 transition-colors",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* 체크박스 */}
        <button
          type="button"
          onClick={() => onToggleCheck(node.id)}
          className="flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          aria-label={`${node.name} ${node.checkState === "checked" ? "선택 해제" : "선택"}`}
          aria-checked={
            node.checkState === "checked"
              ? true
              : node.checkState === "indeterminate"
              ? "mixed"
              : false
          }
          role="checkbox"
        >
          <CheckIcon state={node.checkState} />
        </button>

        {/* 폴더 확장 버튼 또는 파일 아이콘 */}
        {node.type === "folder" ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="flex items-center gap-1.5 flex-1 min-w-0 focus-visible:outline-none"
            aria-expanded={isExpanded}
            aria-label={`${node.name} 폴더 ${isExpanded ? "접기" : "펼치기"}`}
          >
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" aria-hidden="true" />
            ) : (
              <Folder className="h-4 w-4 text-yellow-500 shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm font-medium truncate">{node.name}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FileCode2 className="h-4 w-4 text-blue-500 shrink-0" aria-hidden="true" />
            <span className="text-sm truncate">{node.name}</span>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <ReuseToggle node={node} />
              {node.size !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {(node.size / 1024).toFixed(1)}KB
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 자식 노드 재귀 렌더링 */}
      {node.type === "folder" && isExpanded && node.children && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleCheck={onToggleCheck}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── 파일 트리 패널 ────────────────────────────────────────────
interface FileTreePanelProps {
  nodes: FileNode[];
  totalFiles: number;
  selectedFiles: number;
  expandedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onCheckAll: () => void;
  onUncheckAll: () => void;
  onClear: () => void;
  onDeleteChecked: () => void;
}

export function FileTreePanel({
  nodes,
  totalFiles,
  selectedFiles,
  expandedIds,
  onToggleCheck,
  onToggleExpand,
  onCheckAll,
  onUncheckAll,
  onClear,
  onDeleteChecked,
}: FileTreePanelProps) {
  const [rootExpanded, setRootExpanded] = useState(true);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Folder className="h-10 w-10 mb-3 opacity-40" aria-hidden="true" />
        <p className="text-sm">파일을 업로드하면 트리 구조가 표시됩니다</p>
      </div>
    );
  }

  // 루트 폴더 체크 상태: 전체 파일의 선택 현황에서 도출
  const rootCheckState: CheckState =
    selectedFiles === 0
      ? "unchecked"
      : selectedFiles === totalFiles
      ? "checked"
      : "indeterminate";

  function handleToggleRoot() {
    if (rootCheckState === "checked") onUncheckAll();
    else onCheckAll();
  }

  return (
    <div className="space-y-3">
      {/* 헤더: 선택 통계 + 삭제/초기화 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selectedFiles}</span> / {totalFiles}개 선택
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteChecked}
            disabled={selectedFiles === 0}
            className="h-7 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            선택 삭제
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs text-destructive hover:text-destructive">
            초기화
          </Button>
        </div>
      </div>

      {/* 저장본 일괄 재사용/새로생성 (체크된 파일이 있으면 그 파일만 적용) */}
      <BulkReuseToggle />

      {/* 트리 */}
      <div className="border rounded-lg overflow-auto max-h-64">
        <ul role="tree" aria-label="업로드된 파일 목록" className="py-1">
          {/* 루트 폴더: 체크 시 전체 파일 선택/해제 */}
          <li>
            <div
              className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted/50 transition-colors"
              style={{ paddingLeft: "8px" }}
            >
              <button
                type="button"
                onClick={handleToggleRoot}
                className="flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                aria-label={`전체 파일 ${rootCheckState === "checked" ? "선택 해제" : "선택"}`}
                aria-checked={
                  rootCheckState === "checked"
                    ? true
                    : rootCheckState === "indeterminate"
                    ? "mixed"
                    : false
                }
                role="checkbox"
              >
                <CheckIcon state={rootCheckState} />
              </button>
              <button
                type="button"
                onClick={() => setRootExpanded((v) => !v)}
                className="flex items-center gap-1.5 flex-1 min-w-0 focus-visible:outline-none"
                aria-expanded={rootExpanded}
                aria-label={`전체 파일 폴더 ${rootExpanded ? "접기" : "펼치기"}`}
              >
                {rootExpanded ? (
                  <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" aria-hidden="true" />
                ) : (
                  <Folder className="h-4 w-4 text-yellow-500 shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm font-medium truncate">전체 파일</span>
                <span className="text-xs text-muted-foreground shrink-0">({totalFiles})</span>
              </button>
            </div>

            {rootExpanded && (
              <ul role="group">
                {nodes.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={1}
                    expandedIds={expandedIds}
                    onToggleCheck={onToggleCheck}
                    onToggleExpand={onToggleExpand}
                  />
                ))}
              </ul>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
