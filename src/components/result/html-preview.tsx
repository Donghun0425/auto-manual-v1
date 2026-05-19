"use client";

import { useRef, useEffect } from "react";

interface HtmlPreviewProps {
  htmlContent: string;
}

export function HtmlPreview({ htmlContent }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(htmlContent);
    doc.close();
  }, [htmlContent]);

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
