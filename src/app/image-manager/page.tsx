"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ImageIcon, Upload, Trash2, Loader2, CheckCircle2, AlertCircle, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listScreenImages,
  upsertScreenImage,
  deleteScreenImage,
  type ScreenImageWithUrl,
} from "@/lib/supabase/queries/screen-image";
import { useGenerationStore } from "@/stores/generation-store";
import { baseNameOf } from "@/lib/result/screen-group";

/** 이미지 파일명에서 기본명 추출 (디렉터리·확장자 제거) */
function imageBaseName(fileName: string): string {
  const seg = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  return seg.replace(/\.[^.]+$/, "");
}

export default function ImageManagerPage() {
  const [images, setImages] = useState<ScreenImageWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const generationResult = useGenerationStore((s) => s.result);
  const resultBases = useMemo(() => {
    const set = new Set<string>();
    for (const r of generationResult?.results ?? []) {
      set.add(baseNameOf(r.filePath || r.fileName));
    }
    return set;
  }, [generationResult]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setImages(await listScreenImages());
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;

      setUploading(true);
      let success = 0;
      for (const file of files) {
        const base = imageBaseName(file.name);
        try {
          await upsertScreenImage(base, file);
          success++;
        } catch (err) {
          toast.error(`${file.name} 업로드 실패: ${err instanceof Error ? err.message : ""}`);
        }
      }
      setUploading(false);
      if (success > 0) {
        toast.success(`${success}개 이미지를 업로드했습니다.`);
        await load();
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (fileBase: string) => {
      try {
        await deleteScreenImage(fileBase);
        toast.success("이미지를 삭제했습니다.");
        setImages((prev) => prev.filter((img) => img.file_base !== fileBase));
      } catch (err) {
        toast.error(`삭제 실패: ${err instanceof Error ? err.message : ""}`);
      }
    },
    []
  );

  return (
    <Container>
      <PageHeader
        title="이미지 관리"
        description="분석 파일과 동일한 이름의 화면 이미지를 업로드하면 결과 페이지에 자동 적용됩니다"
      />

      {/* 업로드 영역 */}
      <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            파일명을 분석 파일과 동일하게 지정하세요. 예) <code className="font-mono text-xs">usc_3010501_t01.png</code>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "업로드 중..." : "이미지 업로드"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            aria-hidden="true"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-6">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          불러오는 중...
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">업로드된 이미지가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => {
            const matched = resultBases.has(img.file_base);
            return (
              <Card key={img.file_base} className="overflow-hidden">
                <div className="aspect-video bg-muted/20 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.publicUrl} alt={img.original_name} className="h-full w-full object-contain" />
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium font-mono truncate" title={img.file_base}>
                    {img.file_base}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" title={img.original_name}>
                    {img.original_name}
                  </p>
                  <div className="flex items-center justify-between">
                    {matched ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-500" aria-hidden="true" />
                        결과 매칭
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                        <Link2Off className="h-3 w-3" aria-hidden="true" />
                        미매칭
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(img.file_base)}
                      aria-label={`${img.file_base} 이미지 삭제`}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
