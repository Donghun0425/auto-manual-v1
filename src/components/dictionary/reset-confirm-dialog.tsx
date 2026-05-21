"use client";

import { useState, useEffect } from "react";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_LABELS,
  CONTEXT_TYPE_LABELS,
} from "@/components/dictionary/dummy-data";
import type { DictionaryCategory, DictionaryContextType } from "@/types";

interface ResetConfirmDialogProps {
  open: boolean;
  onConfirm: (category: DictionaryCategory, contextType: DictionaryContextType) => void;
  onCancel: () => void;
  loading?: boolean;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function ResetConfirmDialog({
  open,
  onConfirm,
  onCancel,
  loading = false,
}: ResetConfirmDialogProps) {
  const [category, setCategory] = useState<DictionaryCategory | "">("");
  const [contextType, setContextType] = useState<DictionaryContextType | "">("");
  const [code, setCode] = useState(generateCode);
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState("");

  // 모달 열릴 때마다 상태 초기화 + 새 코드 생성
  useEffect(() => {
    if (open) {
      setCategory("");
      setContextType("");
      setCode(generateCode());
      setUserInput("");
      setError("");
    }
  }, [open]);

  function handleSubmit() {
    if (!category || !contextType) {
      setError("카테고리와 항목유형을 모두 선택해주세요.");
      return;
    }
    if (userInput !== code) {
      setError("화면의 숫자와 맞지 않습니다.");
      return;
    }
    setError("");
    onConfirm(category, contextType);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-title"
      aria-describedby="reset-desc"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-destructive" aria-hidden="true" />
            <h2 id="reset-title" className="text-base font-semibold">단어사전 초기화</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel} aria-label="취소">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-5 space-y-4">
          <p id="reset-desc" className="text-sm text-muted-foreground leading-relaxed">
            선택한 카테고리와 항목유형에 해당하는 모든 용어가 <strong className="text-destructive">영구 삭제</strong>됩니다.
            이 작업은 복구할 수 없습니다.
          </p>

          {/* 카테고리 선택 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              카테고리 <span className="text-destructive">*</span>
            </label>
            <Select
              value={category}
              onValueChange={(v) => { setCategory(v as DictionaryCategory); setError(""); }}
            >
              <SelectTrigger aria-label="카테고리 선택">
                <SelectValue placeholder="카테고리를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [DictionaryCategory, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 항목유형 선택 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              항목유형 <span className="text-destructive">*</span>
            </label>
            <Select
              value={contextType}
              onValueChange={(v) => { setContextType(v as DictionaryContextType); setError(""); }}
            >
              <SelectTrigger aria-label="항목유형 선택">
                <SelectValue placeholder="항목유형을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CONTEXT_TYPE_LABELS) as [DictionaryContextType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 인증 코드 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              아래 숫자를 입력하세요 <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center justify-center py-3 bg-muted rounded-lg">
              <span className="text-2xl font-mono font-bold tracking-[0.3em] select-none">
                {code}
              </span>
            </div>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6자리 숫자 입력"
              value={userInput}
              onChange={(e) => { setUserInput(e.target.value.replace(/\D/g, "")); setError(""); }}
              aria-label="인증 숫자 입력"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </div>

        <Separator />

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            취소
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
            {loading ? "삭제 중..." : "초기화"}
          </Button>
        </div>
      </div>
    </div>
  );
}
