"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileCode2,
  BarChart3,
  Eye,
  AlignLeft,
  ImageIcon,
  Upload,
  Trash2,
  ClipboardCopy,
  Check,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParseResultAccordion, type ScreenNav } from "@/components/result/parse-result-accordion";
import { HtmlPreview } from "@/components/result/html-preview";
import { MarkdownView } from "@/components/result/markdown-view";
import type { ManualResult } from "@/types";

interface ManualDetailViewProps {
  current: ManualResult;
  /** 화면 이미지 dataURL/publicURL (fileName 기준) */
  screenImage?: string;
  /** 화면 탭/팝업 상호 이동용 네비게이션 */
  nav?: ScreenNav;
  /** 이미지 업로드 시 호출 (dataUrl) */
  onSetImage?: (fileName: string, dataUrl: string) => void;
  /** 이미지 삭제 시 호출 */
  onDeleteImage?: (fileName: string) => void;
}

/**
 * 매뉴얼 단일 결과 상세 뷰 (파일 헤더 + 분석/HTML/Markdown 탭 + 이미지/복사).
 * '매뉴얼 결과' 페이지와 '히스토리' 페이지가 공유한다.
 */
export function ManualDetailView({
  current,
  screenImage,
  nav,
  onSetImage,
  onDeleteImage,
}: ManualDetailViewProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onSetImage?.(current.fileName, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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

  const canUploadImage = Boolean(onSetImage);

  return (
    <>
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
          {/* 화면 이미지 */}
          <div className="mb-4 border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">화면 이미지</span>
              </div>
              {canUploadImage && (
                <div className="flex items-center gap-2">
                  {screenImage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteImage?.(current.fileName)}
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
                    {screenImage ? "변경" : "업로드"}
                  </Button>
                </div>
              )}
            </div>
            {screenImage ? (
              <div className="p-4 bg-muted/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenImage}
                  alt="화면 이미지 미리보기"
                  className="max-h-48 rounded border object-contain"
                />
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                업로드된 이미지가 없습니다. HTML 미리보기에 표시할 화면 이미지를 업로드하세요.
              </div>
            )}
            {canUploadImage && (
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                aria-hidden="true"
              />
            )}
          </div>

          <ParseResultAccordion result={current.parseResult} nav={nav} />
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
            <HtmlPreview htmlContent={current.htmlContent} screenImage={screenImage} />
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
    </>
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
