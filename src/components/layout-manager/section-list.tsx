"use client";

import { useRef, useState } from "react";
import { GripVertical, ChevronRight, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { LayoutSection } from "@/types";

interface SectionListProps {
  sections: LayoutSection[];
  selectedId: string | null;
  onToggle: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSelect: (id: string) => void;
}

export function SectionList({
  sections,
  selectedId,
  onToggle,
  onReorder,
  onSelect,
}: SectionListProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(toIndex: number) {
    const from = dragIndexRef.current;
    if (from !== null && from !== toIndex) {
      onReorder(from, toIndex);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <ul role="list" aria-label="매뉴얼 섹션 목록" className="space-y-2">
      {sorted.map((section, index) => {
        const isSelected = section.id === selectedId;
        const isDragOver = dragOverIndex === index;

        return (
          <li
            key={section.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
              isDragOver && "border-primary bg-primary/5 scale-[1.01]",
              !isDragOver && isSelected && "border-primary bg-primary/5",
              !isDragOver && !isSelected && "border-border hover:bg-muted/40",
              !section.enabled && "opacity-60"
            )}
          >
            {/* 드래그 핸들 */}
            <div
              className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
              aria-hidden="true"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* 순서 번호 */}
            <span
              className={cn(
                "text-xs font-mono w-5 text-center shrink-0",
                section.enabled ? "text-muted-foreground" : "text-muted-foreground/50"
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>

            {/* 섹션 이름 (클릭하여 선택) */}
            <button
              type="button"
              className="flex-1 text-left text-sm font-medium focus-visible:outline-none"
              onClick={() => onSelect(section.id)}
              aria-pressed={isSelected}
              aria-label={`${section.name} 섹션 옵션 보기`}
            >
              {section.name}
            </button>

            {/* 옵션 있음 표시 */}
            <span
              className="text-muted-foreground shrink-0"
              aria-hidden="true"
            >
              {isSelected ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>

            {/* 포함/제외 토글 */}
            <Switch
              checked={section.enabled}
              onCheckedChange={() => onToggle(section.id)}
              aria-label={`${section.name} ${section.enabled ? "제외" : "포함"}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
