"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileCode2, BarChart3, Clock } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ManualDetailView } from "@/components/result/manual-detail-view";
import { HistoryTreeSidebar } from "@/components/history/history-tree-sidebar";
import { DownloadBar } from "@/components/result/download-bar";
import { buildScreenGroups, baseNameOf } from "@/lib/result/screen-group";
import { buildHistoryTree, collectDirPaths } from "@/lib/result/history-tree";
import { getScreenImageUrlMap } from "@/lib/supabase/queries/screen-image";
import type { ManualResult } from "@/types";

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileParam = searchParams.get("file");

  const [results, setResults] = useState<ManualResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [screenImages, setScreenImages] = useState<Record<string, string>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // 전체 저장본 로드
  useEffect(() => {
    let cancelled = false;
    fetch("/api/manual-result?list=full")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setResults((data?.results as ManualResult[]) ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 디렉토리 트리 모델
  const tree = useMemo(
    () =>
      buildHistoryTree(
        results.map((r, index) => ({
          fileName: r.fileName,
          index,
          tokens: r.tokenUsage.total_tokens,
        }))
      ),
    [results]
  );

  // 화면 그룹 (탭/팝업 상호 이동용 nav)
  const screenGroups = useMemo(() => buildScreenGroups(results), [results]);

  // 로드 시 모든 디렉토리 펼침
  useEffect(() => {
    if (results.length === 0) return;
    setExpandedPaths(new Set(collectDirPaths(tree)));
  }, [tree, results.length]);

  // ?file= 로 진입 시 해당 파일 자동 선택
  useEffect(() => {
    if (results.length === 0 || !fileParam) return;
    const idx = results.findIndex((r) => r.fileName === fileParam);
    if (idx >= 0) setSelectedIndex(idx);
  }, [results, fileParam]);

  // 이미지 관리 페이지 업로드 이미지를 자동 적용 (file_base 매칭)
  useEffect(() => {
    if (results.length === 0) return;
    let cancelled = false;
    getScreenImageUrlMap()
      .then((urlMap) => {
        if (cancelled) return;
        setScreenImages((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (next[r.fileName]) continue;
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

  function handleToggleExpand(path: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function handleSetImage(fileName: string, dataUrl: string) {
    setScreenImages((prev) => ({ ...prev, [fileName]: dataUrl }));
  }

  function handleDeleteImage(fileName: string) {
    setScreenImages((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }

  const hasResults = results.length > 0;
  const current = results[selectedIndex];
  const totalTokens = results.reduce((sum, r) => sum + r.tokenUsage.total_tokens, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-[400px] text-muted-foreground">
        <Clock className="h-10 w-10 animate-pulse opacity-40" aria-hidden="true" />
        <p className="text-sm">저장된 히스토리를 불러오는 중...</p>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[400px] text-center">
        <FileCode2 className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <p className="text-base font-medium">저장된 히스토리가 없습니다</p>
          <p className="text-sm text-muted-foreground mt-1">매뉴얼을 생성하면 결과가 자동으로 저장됩니다.</p>
        </div>
        <Button onClick={() => router.push("/generate")}>매뉴얼 생성하러 가기</Button>
      </div>
    );
  }

  return (
    <>
      {/* 요약 통계 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-sm">
          <FileCode2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">저장본</span>
          <Badge variant="secondary">{results.length}개</Badge>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5 text-sm">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">총 토큰</span>
          <Badge variant="secondary">{totalTokens.toLocaleString()}</Badge>
        </div>
      </div>

      {/* 다운로드 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <DownloadBar results={results} selectedIndex={selectedIndex} screenImages={screenImages} />
      </div>

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        {/* 디렉토리 트리 사이드바 (1/4) */}
        <aside className="lg:col-span-1">
          <Card>
            <CardContent className="p-3">
              <HistoryTreeSidebar
                root={tree}
                fileCount={results.length}
                selectedIndex={selectedIndex}
                expandedPaths={expandedPaths}
                onSelect={setSelectedIndex}
                onToggleExpand={handleToggleExpand}
              />
            </CardContent>
          </Card>
        </aside>

        {/* 메인 콘텐츠 (3/4) */}
        <main className="lg:col-span-3">
          {current && (
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
              onDeleteImage={handleDeleteImage}
            />
          )}
        </main>
      </div>

      <Separator className="my-8" />
    </>
  );
}

export default function HistoryPage() {
  return (
    <Container>
      <PageHeader
        title="히스토리"
        description="DB에 저장된 매뉴얼 생성 결과를 디렉토리별로 조회합니다"
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px] text-sm text-muted-foreground">
            불러오는 중...
          </div>
        }
      >
        <HistoryContent />
      </Suspense>
    </Container>
  );
}
