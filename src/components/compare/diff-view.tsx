"use client";

import { useMemo } from "react";
import { diffLines, type Change } from "diff";

interface DiffViewProps {
  leftContent: string;
  rightContent: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function DiffView({
  leftContent,
  rightContent,
  leftLabel = "VS Code 프록시",
  rightLabel = "내부 AI (Gemma)",
}: DiffViewProps) {
  const changes = useMemo(
    () => diffLines(leftContent, rightContent),
    [leftContent, rightContent]
  );

  const addedLines = changes.filter((c) => c.added).reduce((s, c) => s + (c.count ?? 0), 0);
  const removedLines = changes.filter((c) => c.removed).reduce((s, c) => s + (c.count ?? 0), 0);
  const identical = addedLines === 0 && removedLines === 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-200 dark:bg-red-900 border border-red-400" />
            -{removedLines}줄
          </span>
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900 border border-green-400" />
            +{addedLines}줄
          </span>
        </div>
        {identical && (
          <span className="text-xs text-muted-foreground">내용이 동일합니다</span>
        )}
      </div>

      {/* 좌우 레이블 */}
      <div className="grid grid-cols-2 border-b text-xs font-medium">
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-r">
          {leftLabel}
        </div>
        <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
          {rightLabel}
        </div>
      </div>

      {/* Diff 내용 */}
      <div className="overflow-auto max-h-[600px] font-mono text-xs leading-relaxed">
        {changes.map((change, idx) => (
          <DiffChunk key={idx} change={change} />
        ))}
      </div>
    </div>
  );
}

function DiffChunk({ change }: { change: Change }) {
  const lines = change.value.split("\n").filter((_, i, arr) => i < arr.length - 1 || arr[i] !== "");
  // 마지막 빈 줄 제거 (diff 라이브러리가 \n로 끝나는 경우 빈 문자열 추가)
  const filteredLines = change.value.endsWith("\n") ? lines : [...lines];

  if (change.added) {
    return (
      <>
        {filteredLines.map((line, i) => (
          <div key={i} className="grid grid-cols-2">
            <div className="px-3 py-0.5 bg-muted/20 text-muted-foreground/40 border-r">
              &nbsp;
            </div>
            <div className="px-3 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300">
              <span className="select-none mr-2 text-green-500">+</span>
              {line}
            </div>
          </div>
        ))}
      </>
    );
  }

  if (change.removed) {
    return (
      <>
        {filteredLines.map((line, i) => (
          <div key={i} className="grid grid-cols-2">
            <div className="px-3 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-r">
              <span className="select-none mr-2 text-red-500">-</span>
              {line}
            </div>
            <div className="px-3 py-0.5 bg-muted/20 text-muted-foreground/40">
              &nbsp;
            </div>
          </div>
        ))}
      </>
    );
  }

  // 변경 없는 줄 (최대 3줄만 표시, 초과 시 접기)
  const CONTEXT_LINES = 3;
  if (filteredLines.length > CONTEXT_LINES * 2 + 1) {
    const head = filteredLines.slice(0, CONTEXT_LINES);
    const tail = filteredLines.slice(-CONTEXT_LINES);
    const collapsed = filteredLines.length - CONTEXT_LINES * 2;
    return (
      <>
        {head.map((line, i) => <UnchangedLine key={`h${i}`} line={line} />)}
        <div className="grid grid-cols-2 bg-muted/50 border-y">
          <div className="px-3 py-1 text-muted-foreground text-xs text-center col-span-2">
            ⋯ {collapsed}줄 생략
          </div>
        </div>
        {tail.map((line, i) => <UnchangedLine key={`t${i}`} line={line} />)}
      </>
    );
  }

  return (
    <>
      {filteredLines.map((line, i) => <UnchangedLine key={i} line={line} />)}
    </>
  );
}

function UnchangedLine({ line }: { line: string }) {
  return (
    <div className="grid grid-cols-2">
      <div className="px-3 py-0.5 text-muted-foreground border-r">
        <span className="select-none mr-2 opacity-30"> </span>
        {line}
      </div>
      <div className="px-3 py-0.5 text-muted-foreground">
        <span className="select-none mr-2 opacity-30"> </span>
        {line}
      </div>
    </div>
  );
}
