"use client";

import * as React from "react";
import { FileCode2, Folder, FolderOpen, CheckCircle2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryDirNode, HistoryFileLeaf } from "@/lib/result/history-tree";

/** 트리에서 모든 파일 리프를 재귀적으로 수집 */
function collectAllFiles(node: HistoryDirNode): HistoryFileLeaf[] {
  const files: HistoryFileLeaf[] = [...node.files];
  for (const dir of node.dirs) {
    files.push(...collectAllFiles(dir));
  }
  return files;
}

interface HistoryTreeSidebarProps {
  root: HistoryDirNode;
  fileCount: number;
  selectedIndex: number;
  expandedPaths: Set<string>;
  onSelect: (index: number) => void;
  onToggleExpand: (path: string) => void;
}

function DirNode({
  node,
  depth,
  selectedIndex,
  expandedPaths,
  onSelect,
  onToggleExpand,
}: {
  node: HistoryDirNode;
  depth: number;
  selectedIndex: number;
  expandedPaths: Set<string>;
  onSelect: (index: number) => void;
  onToggleExpand: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggleExpand(node.path)}
        className="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors text-left"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        aria-expanded={isExpanded}
        aria-label={`${node.name} 폴더 ${isExpanded ? "접기" : "펼치기"}`}
      >
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" aria-hidden="true" />
        ) : (
          <Folder className="h-4 w-4 text-yellow-500 shrink-0" aria-hidden="true" />
        )}
        <span className="text-xs font-medium truncate">{node.name}</span>
      </button>

      {isExpanded && (
        <ul role="group" className="space-y-0.5">
          {node.dirs.map((dir) => (
            <DirNode
              key={dir.path}
              node={dir}
              depth={depth + 1}
              selectedIndex={selectedIndex}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
          {node.files.map((file) => {
            const selected = selectedIndex === file.index;
            return (
              <li key={file.fileName}>
                <button
                  type="button"
                  onClick={() => onSelect(file.index)}
                  className={cn(
                    "w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    selected ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground"
                  )}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
                  aria-current={selected ? "page" : undefined}
                  aria-label={`${file.fileName} 결과 보기`}
                >
                  <FileCode2
                    className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", selected ? "text-primary" : "text-blue-500")}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{file.fileName}</p>
                    {typeof file.tokens === "number" && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
                        <span className="text-[10px] text-muted-foreground">
                          {file.tokens.toLocaleString()} tokens
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function HistoryTreeSidebar({
  root,
  fileCount,
  selectedIndex,
  expandedPaths,
  onSelect,
  onToggleExpand,
}: HistoryTreeSidebarProps) {
  const [query, setQuery] = React.useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const allFiles = React.useMemo(() => collectAllFiles(root), [root]);
  const filteredFiles = trimmedQuery
    ? allFiles.filter((f) => f.fileName.toLowerCase().includes(trimmedQuery))
    : null;

  return (
    <nav aria-label="디렉토리별 저장본 목록">
      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
        분석 파일 ({fileCount}개)
      </p>

      {/* 검색 입력 */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="파일명 검색..."
          className="w-full rounded-md border border-input bg-background pl-7 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          aria-label="파일명 검색"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="검색 초기화"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 목록 (스크롤) */}
      <div className="max-h-[520px] overflow-y-auto pr-0.5">
        {filteredFiles !== null ? (
          /* 검색 결과: 평탄 목록 */
          <ul className="space-y-0.5">
            {filteredFiles.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-muted-foreground">
                검색 결과가 없습니다.
              </li>
            )}
            {filteredFiles.map((file) => {
              const selected = selectedIndex === file.index;
              return (
                <li key={file.fileName}>
                  <button
                    type="button"
                    onClick={() => onSelect(file.index)}
                    className={cn(
                      "w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      selected ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground"
                    )}
                    aria-current={selected ? "page" : undefined}
                    aria-label={`${file.fileName} 결과 보기`}
                  >
                    <FileCode2
                      className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", selected ? "text-primary" : "text-blue-500")}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{file.fileName}</p>
                      {typeof file.tokens === "number" && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
                          <span className="text-[10px] text-muted-foreground">
                            {file.tokens.toLocaleString()} tokens
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          /* 기본 트리 뷰 */
          <ul className="space-y-0.5">
            {root.dirs.map((dir) => (
              <DirNode
                key={dir.path}
                node={dir}
                depth={0}
                selectedIndex={selectedIndex}
                expandedPaths={expandedPaths}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
              />
            ))}
            {/* 루트 직속 파일 (디렉토리 미분류) */}
            {root.files.map((file) => {
              const selected = selectedIndex === file.index;
              return (
                <li key={file.fileName}>
                  <button
                    type="button"
                    onClick={() => onSelect(file.index)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      selected ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground"
                    )}
                    style={{ paddingLeft: "8px" }}
                    aria-current={selected ? "page" : undefined}
                  >
                    <FileCode2
                      className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "text-blue-500")}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium truncate">{file.fileName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
