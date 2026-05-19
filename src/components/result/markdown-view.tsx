"use client";

interface MarkdownViewProps {
  content: string;
}

export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div
      className="border rounded-lg bg-muted/30 p-5 font-mono text-xs leading-relaxed overflow-auto"
      style={{ minHeight: "600px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      role="region"
      aria-label="생성된 Markdown 매뉴얼 내용"
    >
      {content}
    </div>
  );
}
