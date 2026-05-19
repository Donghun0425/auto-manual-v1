"use client";

import {
  LayoutDashboard,
  BookOpen,
  Filter,
  Info,
  Grid3X3,
  Layers,
  MousePointer2,
  StickyNote,
  Eye,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LayoutSection } from "@/types";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />,
  usage: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
  conditions: <Filter className="h-3.5 w-3.5" aria-hidden="true" />,
  info: <Info className="h-3.5 w-3.5" aria-hidden="true" />,
  grid: <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />,
  popup: <Layers className="h-3.5 w-3.5" aria-hidden="true" />,
  tabs: <MousePointer2 className="h-3.5 w-3.5" aria-hidden="true" />,
  notes: <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />,
};

interface LayoutPreviewProps {
  sections: LayoutSection[];
}

export function LayoutPreview({ sections }: LayoutPreviewProps) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const enabled = sorted.filter((s) => s.enabled);
  const disabled = sorted.filter((s) => !s.enabled);

  return (
    <div className="space-y-4" aria-label="레이아웃 미리보기">
      {/* 샘플 헤더 */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <div className="h-4 w-40 bg-muted rounded animate-pulse mb-1.5" aria-hidden="true" />
        <div className="h-2.5 w-60 bg-muted/70 rounded animate-pulse" aria-hidden="true" />
      </div>

      {/* 포함된 섹션 미리보기 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          출력될 섹션 ({enabled.length}개)
        </p>

        {enabled.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg bg-muted/20">
            포함된 섹션이 없습니다.
          </p>
        ) : (
          <ol className="space-y-1.5" aria-label="출력될 섹션 순서">
            {enabled.map((section, index) => (
              <li
                key={section.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-background hover:bg-muted/20 transition-colors"
              >
                <span
                  className="text-xs text-muted-foreground font-mono w-4 shrink-0 text-right"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {SECTION_ICONS[section.id] ?? <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <span className="text-sm font-medium flex-1">
                  {section.options?.customTitle || section.name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {section.options?.showTable === false && (
                    <Badge variant="secondary" className="text-xs h-4 px-1">목록</Badge>
                  )}
                  {section.options?.descriptionDepth === "brief" && (
                    <Badge variant="secondary" className="text-xs h-4 px-1">간략</Badge>
                  )}
                  {section.options?.showExamples && (
                    <Badge variant="outline" className="text-xs h-4 px-1">예시</Badge>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 제외된 섹션 */}
      {disabled.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            제외된 섹션 ({disabled.length}개)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {disabled.map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className="text-xs opacity-50"
              >
                {s.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 샘플 콘텐츠 스켈레톤 */}
      {enabled.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3" aria-hidden="true">
          <p className="text-xs text-muted-foreground mb-2">— 출력 샘플 —</p>
          {enabled.slice(0, 3).map((section) => (
            <div key={section.id} className="space-y-1.5">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-2 w-full bg-muted/60 rounded" />
              <div className="h-2 w-4/5 bg-muted/60 rounded" />
            </div>
          ))}
          {enabled.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              + {enabled.length - 3}개 섹션 더...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
