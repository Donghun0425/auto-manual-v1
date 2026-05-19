"use client";

import { useState } from "react";
import { FileCode2, BarChart3, Eye, AlignLeft, Info } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ParseResultAccordion } from "@/components/result/parse-result-accordion";
import { HtmlPreview } from "@/components/result/html-preview";
import { MarkdownView } from "@/components/result/markdown-view";
import { FileResultSidebar } from "@/components/result/file-result-sidebar";
import { DownloadBar } from "@/components/result/download-bar";
import { useGenerationStore } from "@/stores/generation-store";
import { DUMMY_RESULTS } from "@/components/result/dummy-data";

export default function ResultPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const generationResult = useGenerationStore((s) => s.result);

  // 실제 생성 결과가 있으면 사용, 없으면 더미 데이터
  const results = generationResult?.results && generationResult.results.length > 0
    ? generationResult.results
    : DUMMY_RESULTS;
  const isRealData = Boolean(generationResult?.results && generationResult.results.length > 0);
  const current = results[selectedIndex];

  const totalTokens = results.reduce((sum, r) => sum + r.tokenUsage.total_tokens, 0);

  return (
    <Container>
      <PageHeader
        title="결과"
        description="분석 결과와 생성된 매뉴얼을 확인하고 다운로드하세요"
      />

      {/* 상단: 요약 통계 + 다운로드 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
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

        <DownloadBar results={results} selectedIndex={selectedIndex} />
      </div>

      <div className="grid lg:grid-cols-4 gap-6 items-start">
        {/* 파일 사이드바 (1/4) */}
        <aside className="lg:col-span-1">
          <Card>
            <CardContent className="p-3">
              <FileResultSidebar
                results={results}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            </CardContent>
          </Card>
        </aside>

        {/* 메인 콘텐츠 (3/4) */}
        <main className="lg:col-span-3">
          {/* 현재 선택 파일 표시 */}
          <div className="flex items-center gap-2 mb-4">
            <FileCode2 className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <span className="text-sm font-medium">{current.fileName}</span>
            <Badge variant="outline" className="text-xs" suppressHydrationWarning>
              {new Date(current.generatedAt).toLocaleString("ko-KR")} 생성
            </Badge>
          </div>

          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="analysis" className="gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                분석 결과
              </TabsTrigger>
              <TabsTrigger value="html" className="gap-1.5 text-xs sm:text-sm">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                HTML 미리보기
              </TabsTrigger>
              <TabsTrigger value="markdown" className="gap-1.5 text-xs sm:text-sm">
                <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Markdown
              </TabsTrigger>
            </TabsList>

            {/* 분석 결과 탭 */}
            <TabsContent value="analysis">
              <ParseResultAccordion result={current.parseResult} />
            </TabsContent>

            {/* HTML 미리보기 탭 */}
            <TabsContent value="html">
              {current.htmlContent ? (
                <HtmlPreview htmlContent={current.htmlContent} />
              ) : (
                <EmptyState message="HTML 매뉴얼이 생성되지 않았습니다." />
              )}
            </TabsContent>

            {/* Markdown 탭 */}
            <TabsContent value="markdown">
              {current.markdownContent ? (
                <MarkdownView content={current.markdownContent} />
              ) : (
                <EmptyState message="Markdown 매뉴얼이 생성되지 않았습니다." />
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Separator className="my-8" />
      {!isRealData && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          현재 더미 데이터를 표시하고 있습니다. 매뉴얼 생성 후 실제 결과가 표시됩니다.
        </p>
      )}
    </Container>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border rounded-lg bg-muted/30 min-h-[400px] flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
