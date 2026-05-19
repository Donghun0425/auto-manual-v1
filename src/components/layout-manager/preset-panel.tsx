"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, FolderOpen, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  listLayoutTemplates,
  insertLayoutTemplate,
  updateLayoutTemplate,
  setDefaultLayoutTemplate,
  deleteLayoutTemplate,
} from "@/lib/supabase/queries/layout-template";
import type { LayoutSection, LayoutTemplate } from "@/types";

interface PresetPanelProps {
  currentSections: LayoutSection[];
  templateName: string;
  isDirty: boolean;
  onTemplateNameChange: (name: string) => void;
  onSave: (name: string) => void;
  onLoad: (sections: LayoutSection[]) => void;
}

export function PresetPanel({
  currentSections,
  templateName,
  isDirty,
  onTemplateNameChange,
  onSave,
  onLoad,
}: PresetPanelProps) {
  const [presets, setPresets] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    try {
      setError(null);
      const data = await listLayoutTemplates();
      setPresets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프리셋 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  async function handleSave() {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      const existing = presets.find((p) => p.name === templateName.trim());
      if (existing) {
        await updateLayoutTemplate(existing.id, { sections: currentSections });
      } else {
        await insertLayoutTemplate({
          name: templateName.trim(),
          sections: currentSections,
        });
      }
      onSave(templateName.trim());
      await fetchPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLayoutTemplate(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
    setDeleteId(null);
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultLayoutTemplate(id);
      setPresets((prev) =>
        prev.map((p) => ({ ...p, is_default: p.id === id }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "기본 설정 실패");
    }
  }

  function handleLoad(preset: LayoutTemplate) {
    onLoad(preset.sections);
    onTemplateNameChange(preset.name);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {/* 저장 폼 */}
      <div className="space-y-2">
        <Label htmlFor="preset-name" className="text-sm font-medium">
          프리셋 이름
        </Label>
        <div className="flex gap-2">
          <Input
            id="preset-name"
            placeholder="예: 그리드 중심 레이아웃"
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            className="text-sm"
            aria-describedby="preset-name-hint"
          />
          <Button
            size="sm"
            disabled={!templateName.trim() || saving}
            onClick={handleSave}
            aria-label="현재 레이아웃을 프리셋으로 저장"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            )}
            저장
          </Button>
        </div>
        {isDirty && (
          <p id="preset-name-hint" className="text-xs text-amber-600 dark:text-amber-400">
            저장되지 않은 변경사항이 있습니다.
          </p>
        )}
      </div>

      <Separator />

      {/* 저장된 프리셋 목록 */}
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          저장된 프리셋
          <Badge variant="secondary" className="text-xs ml-auto">{presets.length}개</Badge>
        </p>

        {presets.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            저장된 프리셋이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="저장된 레이아웃 프리셋 목록">
            {presets.map((preset) => (
              <li
                key={preset.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                  preset.is_default && "border-primary/50 bg-primary/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{preset.name}</span>
                    {preset.is_default && (
                      <Badge variant="default" className="text-xs shrink-0">기본</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(preset.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", preset.is_default && "text-yellow-500")}
                    onClick={() => handleSetDefault(preset.id)}
                    aria-label={preset.is_default ? "기본 프리셋" : `${preset.name} 기본으로 설정`}
                    aria-pressed={preset.is_default}
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleLoad(preset)}
                    aria-label={`${preset.name} 불러오기`}
                  >
                    <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>

                  {deleteId === preset.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => handleDelete(preset.id)}
                        aria-label={`${preset.name} 삭제 확인`}
                      >
                        삭제
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setDeleteId(null)}
                        aria-label="취소"
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(preset.id)}
                      aria-label={`${preset.name} 삭제`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
