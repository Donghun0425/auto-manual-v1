"use client";

import { FileCode2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ManualResult } from "@/types";

interface FileResultSidebarProps {
  results: ManualResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function FileResultSidebar({ results, selectedIndex, onSelect }: FileResultSidebarProps) {
  return (
    <nav aria-label="파일별 결과 목록">
      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
        분석 파일 ({results.length}개)
      </p>
      <ul className="space-y-1">
        {results.map((result, index) => (
          <li key={result.filePath}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors",
                selectedIndex === index
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/60 text-foreground"
              )}
              aria-current={selectedIndex === index ? "page" : undefined}
              aria-label={`${result.fileName} 결과 보기`}
            >
              <FileCode2
                className={cn(
                  "h-4 w-4 shrink-0 mt-0.5",
                  selectedIndex === index ? "text-primary" : "text-blue-500"
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{result.fileName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">
                    {result.tokenUsage.total_tokens.toLocaleString()} tokens
                  </span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
