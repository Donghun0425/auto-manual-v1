"use client";

import { useState, useCallback } from "react";
import { Upload, FolderTree, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { FileUploadZone } from "@/components/generate/file-upload-zone";
import { FileTreePanel } from "@/components/generate/file-tree-panel";
import { AiSettingsPanel } from "@/components/generate/ai-settings-panel";
import { GenerationPanel } from "@/components/generate/generation-panel";
import { useFileTreeStore } from "@/stores/file-tree-store";
import { useAiSettingsStore } from "@/stores/ai-settings-store";
import { useGenerationStore } from "@/stores/generation-store";
import { useLayoutEditorStore } from "@/stores/layout-editor-store";
import { useCompareStore } from "@/stores/compare-store";
import type { CompareProvider } from "@/stores/compare-store";
import { processUploadedFiles, collectAllPaths } from "@/lib/file-processor";
import type { OutputType } from "@/types";
import type { GenerateRequestBody, GenerateResponseBody } from "@/app/api/generate/route";

export default function GeneratePage() {
  const { tree, addFiles, clearFiles, toggleCheck, checkAll, uncheckAll } = useFileTreeStore();
  const { settings, updateSettings } = useAiSettingsStore();
  const { options, progress, setOptions } = useGenerationStore();

  // 폴더 열림/닫힘 상태 (로컬)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  function handleToggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      const existingPaths = collectAllPaths(tree.root);
      const { nodes, uploaded } = await processUploadedFiles(files, existingPaths);

      if (nodes.length === 0) return; // 모두 중복이면 무시

      // 폴더 자동 펼침
      const folderIds: string[] = [];
      function collectFolderIds(items: typeof nodes) {
        for (const n of items) {
          if (n.type === "folder") {
            folderIds.push(n.id);
            if (n.children) collectFolderIds(n.children);
          }
        }
      }
      collectFolderIds(nodes);

      setExpandedIds((prev) => new Set([...prev, ...folderIds]));
      addFiles(uploaded, nodes);

      // 업로드된 파일들의 DB 저장본 존재 여부 조회 → 뱃지/재사용 기본값 설정
      const allNames = Array.from(
        new Set(useFileTreeStore.getState().uploadedFiles.map((f) => f.name))
      );
      if (allNames.length > 0) {
        try {
          const res = await fetch(
            `/api/manual-result?fileNames=${encodeURIComponent(allNames.join(","))}`
          );
          if (res.ok) {
            const data = (await res.json()) as {
              summaries?: {
                id: string;
                fileName: string;
                sourceHash: string;
                outputFormats: string[];
                generatedAt: string;
              }[];
            };
            if (data.summaries) {
              useFileTreeStore.getState().setSavedSummaries(data.summaries);
            }
          }
        } catch {
          // 조회 실패 무시 (DB 미설정 등)
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [tree.root, addFiles]);

  function handleClear() {
    clearFiles();
    setExpandedIds(new Set());
  }

  function handleOutputFormatChange(format: OutputType, checked: boolean) {
    const next = checked
      ? [...options.outputFormats, format]
      : options.outputFormats.filter((f) => f !== format);
    setOptions({ outputFormats: next });
  }

  function handleDictionaryChange(checked: boolean) {
    setOptions({ useDictionary: checked });
  }

  function handleUdcContextChange(checked: boolean) {
    setOptions({ useUdcContext: checked });
  }

  function handleGenerate() {
    const selectedFiles = useFileTreeStore.getState().getSelectedFiles();
    if (selectedFiles.length === 0) return;

    const emptyFiles = selectedFiles.filter((f) => !f.content.trim());
    if (emptyFiles.length > 0) {
      alert(`다음 파일의 내용을 읽을 수 없습니다: ${emptyFiles.map((f) => f.name).join(", ")}`);
      return;
    }

    // 생성 시작
    const { startGeneration, updateProgress, addResult, addError, completeGeneration } = useGenerationStore.getState();
    startGeneration(selectedFiles.length);

    const { reuseByPath, savedByFileName } = useFileTreeStore.getState();
    const body: GenerateRequestBody = {
      files: selectedFiles.map((f) => ({
        path: f.path,
        content: f.content,
        // 저장본이 있고 사용자가 새로생성으로 끄지 않았으면 재사용
        reuse: !!savedByFileName[f.name] && reuseByPath[f.path] !== false,
      })),
      settings,
      useDictionary: options.useDictionary,
      useUdcContext: options.useUdcContext,
      outputFormats: options.outputFormats,
      layoutSections: useLayoutEditorStore.getState().sections,
    };

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `HTTP ${res.status}`);
        }
        return res.json() as Promise<GenerateResponseBody>;
      })
      .then((data) => {
        for (const result of data.results) {
          addResult(result);
        }
        for (const error of data.errors) {
          addError(error);
        }
        completeGeneration(data.duration);
        updateProgress({ status: data.errors.length > 0 && data.results.length === 0 ? "error" : "completed" });

        // 새로 저장된 결과를 반영하기 위해 저장본 메타 재조회
        const allNames = Array.from(
          new Set(useFileTreeStore.getState().uploadedFiles.map((f) => f.name))
        );
        if (allNames.length > 0) {
          fetch(`/api/manual-result?fileNames=${encodeURIComponent(allNames.join(","))}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.summaries) useFileTreeStore.getState().setSavedSummaries(d.summaries);
            })
            .catch(() => {});
        }

        // VS Code 프록시 / 내부 AI 결과는 비교 스토어에도 자동 저장
        const provider = settings.provider;
        if ((provider === "vscode-proxy" || provider === "internal") && data.results.length > 0) {
          const fullResult = useGenerationStore.getState().result;
          if (fullResult) {
            useCompareStore.getState().setResult(provider as CompareProvider, fullResult);
          }
        }
      })
      .catch((err) => {
        addError({
          fileName: "전체",
          step: "api-call",
          message: err instanceof Error ? err.message : "알 수 없는 오류",
          timestamp: new Date().toISOString(),
        });
        updateProgress({ status: "error" });
      });
  }

  return (
    <Container>
      <PageHeader
        title="매뉴얼 생성"
        description=".clx.js 파일을 업로드하여 사용자 매뉴얼을 자동 생성합니다"
      />

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* 왼쪽: 파일 업로드 + 트리 (2/3 너비) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 파일 업로드 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" aria-hidden="true" />
                파일 업로드
              </CardTitle>
              <CardDescription>
                단일 파일, 다중 파일, 폴더 단위로 .clx.js 파일을 업로드하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                onFilesSelected={handleFilesSelected}
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          {/* 파일 트리 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderTree className="h-4 w-4" aria-hidden="true" />
                파일 트리
              </CardTitle>
              <CardDescription>
                분석할 파일을 선택하세요 (전체·폴더·개별 선택 가능)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileTreePanel
                nodes={tree.root}
                totalFiles={tree.totalFiles}
                selectedFiles={tree.selectedFiles}
                expandedIds={expandedIds}
                onToggleCheck={toggleCheck}
                onToggleExpand={handleToggleExpand}
                onCheckAll={checkAll}
                onUncheckAll={uncheckAll}
                onClear={handleClear}
              />
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: AI 설정 + 생성 패널 (1/3 너비) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                AI 설정
              </CardTitle>
              <CardDescription>
                API 키, 모델, 프록시 URL을 설정하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiSettingsPanel settings={settings} onChange={updateSettings} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">생성 옵션</CardTitle>
            </CardHeader>
            <CardContent>
              <GenerationPanel
                selectedFileCount={tree.selectedFiles}
                outputFormats={options.outputFormats}
                useDictionary={options.useDictionary}
                useUdcContext={options.useUdcContext}
                progress={progress}
                onOutputFormatChange={handleOutputFormatChange}
                onDictionaryChange={handleDictionaryChange}
                onUdcContextChange={handleUdcContextChange}
                onGenerate={handleGenerate}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="my-8" />

      <p className="text-xs text-muted-foreground text-center">
        단어사전에 등록된 용어는 AI 호출 없이 자동 적용됩니다. &nbsp;
        <a href="/dictionary" className="underline hover:text-foreground">단어사전 관리 →</a>
      </p>
    </Container>
  );
}
