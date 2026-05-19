"use client";

import { useRef, useState } from "react";
import { FileCode2, Upload, FolderOpen, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { collectFilesFromDrop, isClxFile } from "@/lib/file-processor";

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploadZone({ onFilesSelected, disabled }: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const singleRef = useRef<HTMLInputElement>(null);
  const multipleRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const files = await collectFilesFromDrop(e.dataTransfer);
    if (files.length > 0) onFilesSelected(files);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      isClxFile(f.name)
    );
    if (files.length > 0) onFilesSelected(files);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      {/* 드래그앤드롭 존 */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="파일 드래그앤드롭 업로드 영역"
        aria-disabled={disabled}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && singleRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            singleRef.current?.click();
          }
        }}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer select-none",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <FileCode2
          className={cn(
            "w-10 h-10 mx-auto mb-3 transition-colors",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        <p className="text-sm font-medium mb-1">
          .clx.js 파일을 드래그하여 업로드
        </p>
        <p className="text-xs text-muted-foreground">
          또는 아래 버튼으로 파일을 선택하세요
        </p>
      </div>

      {/* 업로드 버튼 그룹 */}
      <div className="grid grid-cols-3 gap-3" role="group" aria-label="파일 선택 방법">
        <Button
          variant="outline"
          size="sm"
          className="flex flex-col h-auto py-3 gap-1.5"
          disabled={disabled}
          onClick={() => singleRef.current?.click()}
          aria-label="단일 파일 선택"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs">단일 파일</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex flex-col h-auto py-3 gap-1.5"
          disabled={disabled}
          onClick={() => multipleRef.current?.click()}
          aria-label="다중 파일 선택"
        >
          <Files className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs">다중 파일</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex flex-col h-auto py-3 gap-1.5"
          disabled={disabled}
          onClick={() => folderRef.current?.click()}
          aria-label="폴더 선택"
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs">폴더</span>
        </Button>
      </div>

      {/* hidden inputs */}
      <input
        ref={singleRef}
        type="file"
        className="hidden"
        accept=".js"
        onChange={handleInputChange}
        aria-hidden="true"
      />
      <input
        ref={multipleRef}
        type="file"
        className="hidden"
        accept=".js"
        multiple
        onChange={handleInputChange}
        aria-hidden="true"
      />
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        // @ts-expect-error webkitdirectory is not in standard types
        webkitdirectory=""
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </div>
  );
}
