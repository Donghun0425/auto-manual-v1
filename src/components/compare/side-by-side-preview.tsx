"use client";

import { HtmlPreview } from "@/components/result/html-preview";
import { MarkdownView } from "@/components/result/markdown-view";

interface SideBySidePreviewProps {
  leftContent: string;
  rightContent: string;
  leftLabel: string;
  rightLabel: string;
  mode: "html" | "markdown";
}

export function SideBySidePreview({
  leftContent,
  rightContent,
  leftLabel,
  rightLabel,
  mode,
}: SideBySidePreviewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 왼쪽: VS Code 프록시 */}
      <div className="flex flex-col gap-2">
        <div className="px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-200 dark:border-blue-800">
          {leftLabel}
        </div>
        {mode === "html" ? (
          <HtmlPreview htmlContent={leftContent} />
        ) : (
          <MarkdownView content={leftContent} />
        )}
      </div>

      {/* 오른쪽: 내부 AI */}
      <div className="flex flex-col gap-2">
        <div className="px-3 py-1.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-xs font-medium border border-orange-200 dark:border-orange-800">
          {rightLabel}
        </div>
        {mode === "html" ? (
          <HtmlPreview htmlContent={rightContent} />
        ) : (
          <MarkdownView content={rightContent} />
        )}
      </div>
    </div>
  );
}
