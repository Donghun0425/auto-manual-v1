"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, FileJson } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface UploadResult {
  componentCount: number;
  upsertedCount: number;
  unchangedCount: number;
}

interface UdcUploadCardProps {
  onUploaded: () => void;
}

export function UdcUploadCard({ onUploaded }: UdcUploadCardProps) {
  const [uploading, setUploading] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!/\.js$/i.test(file.name)) {
      toast.error("udc.js (.js) 파일만 업로드할 수 있습니다.");
      return;
    }
    setUploading(true);
    try {
      const content = await file.text();
      const res = await fetch("/api/udc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, content, replaceAll }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "업로드 실패");
      const r = body as UploadResult;
      toast.success(
        `파싱 완료: 총 ${r.componentCount}개 (신규/수정 ${r.upsertedCount}, 변경없음 ${r.unchangedCount})`
      );
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <FileJson className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">udc.js 업로드</p>
            <p className="text-xs text-muted-foreground">
              eXBuilder6 컴파일된 udc.js 를 파싱하여 컴포넌트 정보를 등록합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="replace-all"
              checked={replaceAll}
              onCheckedChange={(v) => setReplaceAll(v === true)}
            />
            <Label htmlFor="replace-all" className="text-xs cursor-pointer">
              전체 교체
            </Label>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".js"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "업로드 중…" : "파일 선택"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
