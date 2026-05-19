"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { LayoutSection, LayoutSectionOptions } from "@/types";

interface SectionOptionsPanelProps {
  section: LayoutSection;
  onChange: (sectionId: string, options: LayoutSectionOptions) => void;
}

export function SectionOptionsPanel({ section, onChange }: SectionOptionsPanelProps) {
  const opts = section.options ?? {};

  function update(partial: Partial<LayoutSectionOptions>) {
    onChange(section.id, { ...opts, ...partial });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 px-4 py-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {section.name} 세부 옵션
      </p>

      <Separator />

      {/* 커스텀 제목 */}
      <div className="space-y-1.5">
        <Label htmlFor={`title-${section.id}`} className="text-sm">
          섹션 제목 (선택)
        </Label>
        <Input
          id={`title-${section.id}`}
          placeholder={`기본: ${section.name}`}
          value={opts.customTitle ?? ""}
          onChange={(e) => update({ customTitle: e.target.value || undefined })}
          className="h-8 text-sm"
        />
      </div>

      {/* 테이블 표시 여부 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor={`table-${section.id}`} className="text-sm cursor-pointer">
            테이블 형식으로 표시
          </Label>
          <p className="text-xs text-muted-foreground">
            목록을 표 형식으로 출력합니다
          </p>
        </div>
        <Switch
          id={`table-${section.id}`}
          checked={opts.showTable ?? true}
          onCheckedChange={(v) => update({ showTable: v })}
          aria-label="테이블 형식 표시 여부"
        />
      </div>

      {/* 설명 깊이 */}
      <div className="space-y-1.5">
        <Label htmlFor={`depth-${section.id}`} className="text-sm">
          설명 상세 수준
        </Label>
        <Select
          value={opts.descriptionDepth ?? "detailed"}
          onValueChange={(v) =>
            update({ descriptionDepth: v as LayoutSectionOptions["descriptionDepth"] })
          }
        >
          <SelectTrigger
            id={`depth-${section.id}`}
            className="h-8 text-sm"
            aria-label="설명 상세 수준 선택"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="brief">간략 (용어명만)</SelectItem>
            <SelectItem value="detailed">상세 (설명 포함)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 예시 표시 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor={`examples-${section.id}`} className="text-sm cursor-pointer">
            예시 데이터 표시
          </Label>
          <p className="text-xs text-muted-foreground">
            샘플 데이터를 함께 출력합니다
          </p>
        </div>
        <Switch
          id={`examples-${section.id}`}
          checked={opts.showExamples ?? false}
          onCheckedChange={(v) => update({ showExamples: v })}
          aria-label="예시 데이터 표시 여부"
        />
      </div>
    </div>
  );
}
