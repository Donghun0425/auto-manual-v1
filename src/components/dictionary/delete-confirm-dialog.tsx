"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface DeleteConfirmDialogProps {
  open: boolean;
  termName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirmDialog({ open, termName, onConfirm, onCancel, loading = false }: DeleteConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-desc"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-sm">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            <h2 id="delete-title" className="text-base font-semibold">용어 삭제</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel} aria-label="취소">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-5">
          <p id="delete-desc" className="text-sm text-muted-foreground leading-relaxed">
            <code className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
              {termName}
            </code>{" "}
            용어를 삭제하면 복구할 수 없습니다.
            <br />
            정말 삭제하시겠습니까?
          </p>
        </div>

        <Separator />

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm} autoFocus disabled={loading}>
            {loading ? "삭제 중..." : "삭제"}
          </Button>
        </div>
      </div>
    </div>
  );
}
