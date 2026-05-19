"use client";

import { FileCode2, Folder, FolderOpen, Minus, Square, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FileNode, CheckState } from "@/types";

// ── 개별 체크박스 아이콘 ──────────────────────────────────────
function CheckIcon({ state }: { state: CheckState }) {
  if (state === "checked")
    return <CheckSquare className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
  if (state === "indeterminate")
    return <Minus className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
  return <Square className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />;
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
            {node.size !== undefined && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {(node.size / 1024).toFixed(1)}KB
              </span>
            )}
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
}: FileTreePanelProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Folder className="h-10 w-10 mb-3 opacity-40" aria-hidden="true" />
        <p className="text-sm">파일을 업로드하면 트리 구조가 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더: 선택 통계 + 일괄 버튼 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selectedFiles}</span> / {totalFiles}개 선택
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCheckAll} className="h-7 text-xs">
            전체 선택
          </Button>
          <Button variant="ghost" size="sm" onClick={onUncheckAll} className="h-7 text-xs">
            전체 해제
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs text-destructive hover:text-destructive">
            초기화
          </Button>
        </div>
      </div>

      {/* 트리 */}
      <div className="border rounded-lg overflow-auto max-h-64">
        <ul role="tree" aria-label="업로드된 파일 목록" className="py-1">
          {nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              onToggleCheck={onToggleCheck}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
