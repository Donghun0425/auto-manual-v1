"use client";

import { Download, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ManualResult } from "@/types";

interface DownloadBarProps {
  results: ManualResult[];
  selectedIndex: number;
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

async function downloadZip(results: ManualResult[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const result of results) {
    const baseName = result.fileName.replace(/\.clx\.js$/, "");
    if (result.htmlContent) {
      zip.file(`${baseName}.html`, result.htmlContent);
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

export function DownloadBar({ results, selectedIndex }: DownloadBarProps) {
  const current = results[selectedIndex];
  const baseName = current?.fileName.replace(/\.clx\.js$/, "") ?? "manual";
  const hasHtml = Boolean(current?.htmlContent);
  const hasMd = Boolean(current?.markdownContent);
  const hasMultiple = results.length > 1;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="매뉴얼 다운로드">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasHtml}
        onClick={() => downloadBlob(current.htmlContent!, `${baseName}.html`, "text/html;charset=utf-8")}
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
            onClick={() => downloadZip(results)}
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
