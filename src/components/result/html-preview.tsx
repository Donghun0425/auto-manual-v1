"use client";

import { useRef, useEffect } from "react";

interface HtmlPreviewProps {
  htmlContent: string;
  screenImage?: string;
}

function injectImageIntoHtml(html: string, dataUrl: string): string {
  const css = `.screen-image{margin:0 0 20px;text-align:center;}.screen-image img{max-width:100%;border:1px solid #e4e4e7;border-radius:6px;}`;
  const imgTag = `<div class="screen-image"><img src="${dataUrl}" alt="화면 이미지" /></div>`;
  return html
    .replace(/<\/style>/, `${css}\n</style>`)
    .replace(/<\/h1>/, `</h1>\n${imgTag}`);
}

export function HtmlPreview({ htmlContent, screenImage }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    const content = screenImage ? injectImageIntoHtml(htmlContent, screenImage) : htmlContent;
    doc.open();
    doc.write(content);
    doc.close();
  }, [htmlContent, screenImage]);

  return (
    <iframe
      ref={iframeRef}
      title="HTML 매뉴얼 미리보기"
      className="w-full border-0 rounded-lg bg-white"
      style={{ minHeight: "600px" }}
      sandbox="allow-same-origin"
      aria-label="생성된 HTML 매뉴얼 미리보기"
    />
  );
}
