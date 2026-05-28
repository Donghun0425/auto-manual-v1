"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, BarChart3, Eye, AlignLeft, ImageIcon, Upload, Trash2, ClipboardCopy, Check, GitCompare, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ParseResultAccordion } from "@/components/result/parse-result-accordion";
import { HtmlPreview } from "@/components/result/html-preview";
import { MarkdownView } from "@/components/result/markdown-view";
import { FileResultSidebar } from "@/components/result/file-result-sidebar";
import { DownloadBar } from "@/components/result/download-bar";
import { useGenerationStore } from "@/stores/generation-store";
import { useCompareStore } from "@/stores/compare-store";
import { useAiSettingsStore } from "@/stores/ai-settings-store";
import type { CompareProvider } from "@/stores/compare-store";

export default function ResultPage() {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [screenImages, setScreenImages] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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

  function handleSaveToCompare() {
    if (!generationResult || !isComparableProvider) return;
    saveToCompare(currentProvider as CompareProvider, generationResult);
    setSavedToCompare(true);
    setTimeout(() => setSavedToCompare(false), 2000);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setScreenImages((prev) => ({ ...prev, [current.fileName]: dataUrl }));
    };
    reader.readAsDataURL(file);
    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = "";
  }

  function handleImageDelete(fileName: string) {
    setScreenImages((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }

  const handleCopy = useCallback((text: string, key: string) => {
    const onSuccess = () => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onSuccess);
    } else {
      // HTTP 환경(비보안 컨텍스트) fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        onSuccess();
      } catch {
        // 복사 실패 시 무시
      }
      document.body.removeChild(textarea);
    }
  }, []);

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
              {/* 화면 이미지 업로드 */}
              <div className="mb-4 border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium">화면 이미지</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {screenImages[current.fileName] ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImageDelete(current.fileName)}
                        aria-label="화면 이미지 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                        삭제
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                      aria-label="화면 이미지 업로드"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      {screenImages[current.fileName] ? "변경" : "업로드"}
                    </Button>
                  </div>
                </div>
                {screenImages[current.fileName] ? (
                  <div className="p-4 bg-muted/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenImages[current.fileName]}
                      alt="화면 이미지 미리보기"
                      className="max-h-48 rounded border object-contain"
                    />
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    업로드된 이미지가 없습니다. HTML 미리보기에 표시할 화면 이미지를 업로드하세요.
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  aria-hidden="true"
                />
              </div>

              <ParseResultAccordion result={current.parseResult} />
            </TabsContent>

            {/* HTML 미리보기 탭 */}
            <TabsContent value="html">
              {/* 섹션별 복사 버튼 */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(["화면개요", "사용방법", "참고사항"] as const).map((section) => {
                  const key = `${current.fileName}-${section}`;
                  const isCopied = copied === key;
                  const text = extractMarkdownSection(current.markdownContent, section);
                  return (
                    <Button
                      key={section}
                      variant="outline"
                      size="sm"
                      disabled={!text}
                      onClick={() => handleCopy(text, key)}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                    >
                      {isCopied ? <Check className="h-3 w-3 mr-1" /> : <ClipboardCopy className="h-3 w-3 mr-1" />}
                      {isCopied ? "복사됨" : section}
                    </Button>
                  );
                })}
                {(() => {
                  const key = `${current.fileName}-항목`;
                  const isCopied = copied === key;
                  const itemsHtml = extractItemsHtml(current.htmlContent);
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!itemsHtml}
                      onClick={() => handleCopy(itemsHtml, key)}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
                    >
                      {isCopied ? <Check className="h-3 w-3 mr-1" /> : <ClipboardCopy className="h-3 w-3 mr-1" />}
                      {isCopied ? "복사됨" : "항목"}
                    </Button>
                  );
                })()}
              </div>

              {current.htmlContent ? (
                <HtmlPreview htmlContent={current.htmlContent} screenImage={screenImages[current.fileName]} />
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

// ── 섹션 복사 유틸 ───────────────────────────────────────────

function stripBTags(text: string) {
  return text.replace(/\{B\}|\{\/B\}/g, "");
}

function extractMarkdownSection(
  markdown: string | undefined,
  section: "화면개요" | "사용방법" | "참고사항"
): string {
  if (!markdown) return "";
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.startsWith("## ") && l.includes(section));
  if (startIdx < 0) return "";
  const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith("## "));
  const bodyLines = endIdx < 0 ? lines.slice(startIdx + 1) : lines.slice(startIdx + 1, endIdx);

  if (section === "화면개요") {
    return bodyLines
      .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("!"))
      .map(stripBTags)
      .join("\n")
      .trim();
  }
  if (section === "사용방법") {
    return bodyLines.join("\n").trim();
  }
  // 참고사항
  return bodyLines.map(stripBTags).join("\n").trim();
}

function extractItemsHtml(html: string | undefined): string {
  if (!html) return "";
  const start = html.indexOf("<h2>항목</h2>");
  if (start < 0) return "";
  const nextH2 = html.indexOf("<h2>", start + 1);
  const bodyEnd = html.indexOf("</body>", start);
  const end = nextH2 >= 0 ? nextH2 : bodyEnd >= 0 ? bodyEnd : html.length;
  return html.slice(start, end).trim();
}
