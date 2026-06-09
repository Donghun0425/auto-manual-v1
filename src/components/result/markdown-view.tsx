"use client";

import { useState } from "react";
import { Eye, AlignLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

interface MarkdownViewProps {
  content: string;
}

type ViewMode = "preview" | "raw";

export function MarkdownView({ content }: MarkdownViewProps) {
  const [mode, setMode] = useState<ViewMode>("preview");

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "preview" ? "default" : "outline"}
          onClick={() => setMode("preview")}
          aria-pressed={mode === "preview"}
        >
          <Eye className="size-4" />
          미리보기
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "raw" ? "default" : "outline"}
          onClick={() => setMode("raw")}
          aria-pressed={mode === "raw"}
        >
          <AlignLeft className="size-4" />
          원본
        </Button>
      </div>

      {mode === "preview" ? (
        <div
          className="border rounded-lg bg-background p-6 overflow-auto prose prose-sm dark:prose-invert max-w-none"
          style={{ minHeight: "600px" }}
          role="region"
          aria-label="생성된 Markdown 매뉴얼 미리보기"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <div
          className="border rounded-lg bg-muted/30 p-5 font-mono text-xs leading-relaxed overflow-auto"
          style={{ minHeight: "600px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          role="region"
          aria-label="생성된 Markdown 매뉴얼 원본"
        >
          {content}
        </div>
      )}
    </div>
  );
}
