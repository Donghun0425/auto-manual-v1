"use client";

import * as React from "react";
import { FileCode2, CheckCircle2, Layers, ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManualResult } from "@/types";
import type { ScreenGroupView, ScreenGroupChild } from "@/lib/result/screen-group";

interface FileResultSidebarProps {
  results: ManualResult[];
  groups: ScreenGroupView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function NodeButton({
  index,
  fileName,
  label,
  tokens,
  selected,
  depth,
  icon,
  onSelect,
}: {
  index: number;
  fileName: string;
  label?: string;
  tokens?: number;
  selected: boolean;
  depth: number;
  icon: React.ReactNode;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cn(
        "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
        selected ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground"
      )}
      style={{ paddingLeft: depth > 0 ? `${depth * 16 + 12}px` : undefined }}
      aria-current={selected ? "page" : undefined}
      aria-label={`${fileName} 결과 보기`}
    >
      <span className={cn("shrink-0 mt-0.5", selected ? "text-primary" : "text-blue-500")} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{label || fileName}</p>
        {label && <p className="text-[10px] text-muted-foreground truncate">{fileName}</p>}
        {typeof tokens === "number" && (
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
            <span className="text-[10px] text-muted-foreground">
              {tokens.toLocaleString()} tokens
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function ChildSection({
  title,
  items,
  selectedIndex,
  onSelect,
}: {
  title: string;
  items: ScreenGroupChild[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mt-1">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mt-1.5 mb-0.5">
        {title} ({items.length})
      </p>
      <ul className="space-y-0.5">
        {items.map((child) => (
          <li key={child.fileName}>
            <NodeButton
              index={child.index}
              fileName={child.fileName}
              label={child.label}
              selected={selectedIndex === child.index}
              depth={1}
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FileResultSidebar({ results, groups, selectedIndex, onSelect }: FileResultSidebarProps) {
  const [query, setQuery] = React.useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const filteredGroups = trimmedQuery
    ? groups.filter(
        (g) =>
          g.mainFileName.toLowerCase().includes(trimmedQuery) ||
          (g.mainLabel ?? "").toLowerCase().includes(trimmedQuery) ||
          g.tabs.some(
            (t) =>
              t.fileName.toLowerCase().includes(trimmedQuery) ||
              (t.label ?? "").toLowerCase().includes(trimmedQuery)
          ) ||
          g.popups.some(
            (p) =>
              p.fileName.toLowerCase().includes(trimmedQuery) ||
              (p.label ?? "").toLowerCase().includes(trimmedQuery)
          )
      )
    : groups;

  return (
    <nav aria-label="파일별 결과 목록">
      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
        분석 파일 ({results.length}개 · {groups.length}개 화면)
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
        <ul className="space-y-3">
          {filteredGroups.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              검색 결과가 없습니다.
            </li>
          )}
          {filteredGroups.map((group) => {
            const hasChildren = group.tabs.length > 0 || group.popups.length > 0;
            return (
              <li key={group.groupKey} className={cn(hasChildren && "rounded-lg border border-border/60 p-1.5")}>
                {group.mainIndex !== null ? (
                  <NodeButton
                    index={group.mainIndex}
                    fileName={group.mainFileName}
                    label={hasChildren ? group.mainLabel : undefined}
                    tokens={results[group.mainIndex]?.tokenUsage.total_tokens}
                    selected={selectedIndex === group.mainIndex}
                    depth={0}
                    icon={hasChildren ? <Layers className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}
                    onSelect={onSelect}
                  />
                ) : (
                  <p className="px-3 py-1 text-[11px] font-medium text-muted-foreground">{group.groupKey}</p>
                )}

                {group.tabs.length > 0 && (
                  <ChildSection title="탭페이지" items={group.tabs} selectedIndex={selectedIndex} onSelect={onSelect} />
                )}
                {group.popups.length > 0 && (
                  <ChildSection title="팝업" items={group.popups} selectedIndex={selectedIndex} onSelect={onSelect} />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
