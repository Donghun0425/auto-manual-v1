"use client";

import { Download, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ManualResult } from "@/types";

interface DownloadBarProps {
  results: ManualResult[];
  selectedIndex: number;
  screenImages?: Record<string, string>;
}

function injectImageIntoHtml(html: string, dataUrl: string): string {
  const css = `.screen-image{margin:0 0 20px;text-align:center;}.screen-image img{max-width:100%;border:1px solid #e4e4e7;border-radius:6px;}`;
  const imgTag = `<div class="screen-image"><img src="${dataUrl}" alt="화면 이미지" /></div>`;
  return html
    .replace(/<\/style>/, `${css}\n</style>`)
    .replace(/<\/h1>/, `</h1>\n${imgTag}`);
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip(results: ManualResult[], screenImages?: Record<string, string>) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const result of results) {
    const baseName = result.fileName.replace(/\.clx\.js$/, "");
    if (result.htmlContent) {
      const image = screenImages?.[result.fileName];
      const html = image ? injectImageIntoHtml(result.htmlContent, image) : result.htmlContent;
      zip.file(`${baseName}.html`, html);
    }
    if (result.markdownContent) {
      zip.file(`${baseName}.md`, result.markdownContent);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "manuals.zip";
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadBar({ results, selectedIndex, screenImages }: DownloadBarProps) {
  const current = results[selectedIndex];
  const baseName = current?.fileName.replace(/\.clx\.js$/, "") ?? "manual";
  const hasHtml = Boolean(current?.htmlContent);
  const hasMd = Boolean(current?.markdownContent);
  const hasMultiple = results.length > 1;

  function handleHtmlDownload() {
    const image = screenImages?.[current.fileName];
    const html = image ? injectImageIntoHtml(current.htmlContent!, image) : current.htmlContent!;
    downloadBlob(html, `${baseName}.html`, "text/html;charset=utf-8");
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="매뉴얼 다운로드">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasHtml}
        onClick={handleHtmlDownload}
        aria-label={`${baseName}.html 다운로드`}
      >
        <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
        HTML
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={!hasMd}
        onClick={() => downloadBlob(current.markdownContent!, `${baseName}.md`, "text/markdown;charset=utf-8")}
        aria-label={`${baseName}.md 다운로드`}
      >
        <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
        Markdown
      </Button>

      {hasMultiple && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadZip(results, screenImages)}
            aria-label="전체 파일 ZIP 일괄 다운로드"
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            전체 ZIP ({results.length}개)
          </Button>
        </>
      )}
    </div>
  );
}
