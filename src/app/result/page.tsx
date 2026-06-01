"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, BarChart3, GitCompare, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ManualDetailView } from "@/components/result/manual-detail-view";
import { FileResultSidebar } from "@/components/result/file-result-sidebar";
import { DownloadBar } from "@/components/result/download-bar";
import { buildScreenGroups, baseNameOf } from "@/lib/result/screen-group";
import { getScreenImageUrlMap } from "@/lib/supabase/queries/screen-image";
import { useGenerationStore } from "@/stores/generation-store";
import { useCompareStore } from "@/stores/compare-store";
import { useAiSettingsStore } from "@/stores/ai-settings-store";
import type { CompareProvider } from "@/stores/compare-store";

export default function ResultPage() {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [screenImages, setScreenImages] = useState<Record<string, string>>({});
  const generationResult = useGenerationStore((s) => s.result);
  const { settings } = useAiSettingsStore();
  const { setResult: saveToCompare, vsCodeProxyResult, internalResult } = useCompareStore();
  const [savedToCompare, setSavedToCompare] = useState<boolean>(false);

  const currentProvider = settings.provider;
  const isComparableProvider = currentProvider === "vscode-proxy" || currentProvider === "internal";
  const alreadySaved =
    currentProvider === "vscode-proxy" ? !!vsCodeProxyResult :
    currentProvider === "internal" ? !!internalResult :
    false;

  const results = generationResult?.results ?? [];
  const hasResults = results.length > 0;
  const current = results[selectedIndex];

  // 화면 그룹 모델 (메인↔탭↔팝업 계층 + 상호 이동)
  const screenGroups = useMemo(() => buildScreenGroups(results), [results]);

  const totalTokens = results.reduce((sum, r) => sum + r.tokenUsage.total_tokens, 0);

  // 결과가 있을 때 서버사이드 캐시에 저장 (PDF 스크린샷 스크립트용)
  useEffect(() => {
    if (generationResult) {
      fetch("/api/result-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: generationResult }),
      }).catch(() => {});
    }
  }, [generationResult]);

  // 이미지 관리 페이지에 업로드된 화면 이미지를 결과에 자동 적용
  // (file_base 매칭). 수동 업로드한 항목은 덮어쓰지 않음(공존).
  useEffect(() => {
    if (results.length === 0) return;
    let cancelled = false;
    getScreenImageUrlMap()
      .then((urlMap) => {
        if (cancelled) return;
        setScreenImages((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (next[r.fileName]) continue; // 수동 업로드 우선
            const url = urlMap[baseNameOf(r.filePath || r.fileName)];
            if (url) next[r.fileName] = url;
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [results]);

  function handleSaveToCompare() {
    if (!generationResult || !isComparableProvider) return;
    saveToCompare(currentProvider as CompareProvider, generationResult);
    setSavedToCompare(true);
    setTimeout(() => setSavedToCompare(false), 2000);
  }

  function handleSetImage(fileName: string, dataUrl: string) {
    setScreenImages((prev) => ({ ...prev, [fileName]: dataUrl }));
  }

  function handleImageDelete(fileName: string) {
    setScreenImages((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }

  if (!hasResults) {
    return (
      <Container>
        <PageHeader
          title="결과"
          description="분석 결과와 생성된 매뉴얼을 확인하고 다운로드하세요"
        />
        <div className="flex flex-col items-center justify-center gap-4 min-h-[400px] text-center">
          <FileCode2 className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="text-base font-medium">생성된 결과가 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">매뉴얼 생성 후 결과를 확인할 수 있습니다.</p>
          </div>
          <Button onClick={() => router.push("/generate")}>
            매뉴얼 생성하러 가기
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title="결과"
        description="분석 결과와 생성된 매뉴얼을 확인하고 다운로드하세요"
      />

      {/* 상단 1행: 요약 통계 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-sm">
          <FileCode2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">분석 파일</span>
          <Badge variant="secondary">{results.length}개</Badge>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5 text-sm">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">총 토큰</span>
          <Badge variant="secondary">{totalTokens.toLocaleString()}</Badge>
        </div>
      </div>

      {/* 상단 2행: 다운로드 + 비교 저장 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <DownloadBar results={results} selectedIndex={selectedIndex} screenImages={screenImages} />

        {/* 비교용 저장 버튼 (VS Code 프록시 / 내부 AI 결과만 가능) */}
        {isComparableProvider && (
          <Button
            variant={alreadySaved ? "secondary" : "outline"}
            size="sm"
            onClick={handleSaveToCompare}
            disabled={savedToCompare}
            className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950"
          >
            {savedToCompare ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {savedToCompare
              ? "저장됨"
              : alreadySaved
              ? "비교용 재저장"
              : "비교용으로 저장"}
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        {/* 파일 사이드바 (1/4) */}
        <aside className="lg:col-span-1">
          <Card>
            <CardContent className="p-3">
              <FileResultSidebar
                results={results}
                groups={screenGroups.groups}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            </CardContent>
          </Card>
        </aside>

        {/* 메인 콘텐츠 (3/4) */}
        <main className="lg:col-span-3">
          <ManualDetailView
            current={current}
            screenImage={screenImages[current.fileName]}
            nav={{
              results,
              resolveIndexByUri: screenGroups.resolveIndexByUri,
              onNavigate: setSelectedIndex,
              parentIndex: screenGroups.getParentIndex(selectedIndex),
              parentLabel:
                screenGroups.getParentIndex(selectedIndex) !== undefined
                  ? results[screenGroups.getParentIndex(selectedIndex)!]?.fileName
                  : undefined,
            }}
            onSetImage={handleSetImage}
            onDeleteImage={handleImageDelete}
          />
        </main>
      </div>

      <Separator className="my-8" />
    </Container>
  );
}
