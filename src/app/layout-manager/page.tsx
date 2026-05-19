"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SectionList } from "@/components/layout-manager/section-list";
import { SectionOptionsPanel } from "@/components/layout-manager/section-options-panel";
import { PresetPanel } from "@/components/layout-manager/preset-panel";
import { LayoutPreview } from "@/components/layout-manager/layout-preview";
import { useLayoutEditorStore } from "@/stores/layout-editor-store";
import {
  getDefaultLayoutTemplate,
  insertLayoutTemplate,
  updateLayoutTemplate,
} from "@/lib/supabase/queries/layout-template";
import type { LayoutSectionOptions } from "@/types";

export default function LayoutManagerPage() {
  const {
    sections,
    templateName,
    isDirty,
    setTemplateName,
    toggleSection,
    reorderSections,
    updateSectionOptions,
    resetToDefault,
    setSections,
  } = useLayoutEditorStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);

  // 기본 템플릿 로드
  useEffect(() => {
    getDefaultLayoutTemplate().then((tmpl) => {
      if (tmpl) {
        setSections(tmpl.sections);
        setTemplateName(tmpl.name);
        setCurrentTemplateId(tmpl.id);
      }
    }).catch(() => {});
  }, [setSections, setTemplateName]);

  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleSectionOptionsChange(sectionId: string, options: LayoutSectionOptions) {
    updateSectionOptions(sectionId, options);
  }

  function handlePresetSave(name: string) {
    setTemplateName(name);
  }

  function handlePresetLoad(newSections: typeof sections) {
    if (newSections.length > 0) {
      setSections(newSections);
    }
  }

  const handleSaveLayout = useCallback(async () => {
    setSaving(true);
    try {
      if (currentTemplateId) {
        await updateLayoutTemplate(currentTemplateId, {
          sections,
          name: templateName || undefined,
        });
      } else {
        const name = templateName || "기본 레이아웃";
        const result = await insertLayoutTemplate({
          name,
          sections,
          is_default: true,
        });
        setCurrentTemplateId(result.id);
        setTemplateName(name);
      }
      // isDirty를 false로 리셋
      setSections(sections);
    } catch {
      // 에러는 무시 (UI에서 별도 처리 안함)
    } finally {
      setSaving(false);
    }
  }, [currentTemplateId, sections, templateName, setSections, setTemplateName]);

  return (
    <Container>
      <PageHeader
        title="레이아웃 관리"
        description="매뉴얼 출력 형식의 섹션 구성과 순서를 커스터마이징하세요"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 좌측: 편집 영역 */}
        <div className="space-y-4">
          <Tabs defaultValue="sections" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="sections" className="flex-1">섹션 구성</TabsTrigger>
              <TabsTrigger value="presets" className="flex-1">프리셋 관리</TabsTrigger>
            </TabsList>

            {/* 섹션 구성 탭 */}
            <TabsContent value="sections" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">섹션 순서 및 포함 설정</CardTitle>
                  <CardDescription className="text-sm">
                    드래그로 순서를 변경하고 토글로 섹션을 포함/제외하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SectionList
                    sections={sections}
                    selectedId={selectedId}
                    onToggle={toggleSection}
                    onReorder={reorderSections}
                    onSelect={handleSelect}
                  />
                </CardContent>
              </Card>

              {/* 선택된 섹션 옵션 */}
              {selectedSection && (
                <SectionOptionsPanel
                  section={selectedSection}
                  onChange={handleSectionOptionsChange}
                />
              )}

              {/* 하단 버튼 */}
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefault}
                  className="gap-1.5"
                  aria-label="기본값으로 초기화"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  초기화
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 ml-auto"
                  disabled={!isDirty || saving}
                  onClick={handleSaveLayout}
                  aria-label="레이아웃 저장"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {isDirty ? "변경사항 저장" : "저장됨"}
                </Button>
              </div>
            </TabsContent>

            {/* 프리셋 탭 */}
            <TabsContent value="presets" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">레이아웃 프리셋</CardTitle>
                  <CardDescription className="text-sm">
                    현재 레이아웃을 저장하거나 저장된 프리셋을 불러오세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PresetPanel
                    currentSections={sections}
                    templateName={templateName}
                    isDirty={isDirty}
                    onTemplateNameChange={setTemplateName}
                    onSave={handlePresetSave}
                    onLoad={handlePresetLoad}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* 우측: 미리보기 */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">레이아웃 미리보기</CardTitle>
              <CardDescription className="text-sm">
                현재 설정이 적용된 매뉴얼 구조를 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LayoutPreview sections={sections} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
