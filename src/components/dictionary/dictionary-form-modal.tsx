"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Dictionary, DictionaryCategory, DictionaryContextType } from "@/types";
import { CATEGORY_LABELS, CONTEXT_TYPE_LABELS } from "./dummy-data";

const schema = z.object({
  term: z.string().min(1, "용어명을 입력하세요.").max(100, "100자 이내로 입력하세요."),
  context_type: z.enum(["조회조건", "그리드", "처리조건", "인포영역"] as const),
  category: z.enum(["공통", "학사", "행정", "연구", "부속", "기타"] as const),
  description: z.string().min(1, "설명을 입력하세요.").max(500, "500자 이내로 입력하세요."),
});

type FormValues = z.infer<typeof schema>;

interface OriginalKey {
  term: string;
  context_type: DictionaryContextType;
}

interface DictionaryFormModalProps {
  open: boolean;
  editItem: Dictionary | null;
  onClose: () => void;
  onSubmit: (values: FormValues, original?: OriginalKey) => void;
  submitting?: boolean;
}

export function DictionaryFormModal({ open, editItem, onClose, onSubmit, submitting = false }: DictionaryFormModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { term: "", context_type: "그리드" as DictionaryContextType, category: "공통", description: "" },
  });

  // 편집 모드일 때 폼 값 채우기
  useEffect(() => {
    if (editItem) {
      setValue("term", editItem.term);
      setValue("context_type", editItem.context_type as DictionaryContextType);
      setValue("category", editItem.category as DictionaryCategory);
      setValue("description", editItem.description);
    } else {
      reset({ term: "", context_type: "그리드", category: "공통", description: "" });
    }
  }, [editItem, setValue, reset]);

  function handleClose() {
    reset();
    onClose();
  }

  if (!open) return null;

  return (
    // 백드롭
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="modal-title" className="text-base font-semibold">
            {editItem ? "용어 수정" : "용어 추가"}
          </h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose} aria-label="닫기">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* 폼 */}
        <form
          onSubmit={handleSubmit((values) => {
            onSubmit(
              values,
              editItem ? { term: editItem.term, context_type: editItem.context_type } : undefined
            );
          })}
          noValidate
        >
          <div className="px-6 py-5 space-y-4">
            {/* 용어명 */}
            <div className="space-y-1.5">
              <Label htmlFor="term" className="text-sm">
                용어명 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="term"
                placeholder="예: 수강신청, 성적처리, 공문서관리"
                autoFocus
                aria-describedby={errors.term ? "term-error" : undefined}
                {...register("term")}
              />
              {errors.term && (
                <p id="term-error" role="alert" className="text-xs text-destructive">
                  {errors.term.message}
                </p>
              )}
            </div>

            {/* 항목유형 */}
            <div className="space-y-1.5">
              <Label htmlFor="context_type" className="text-sm">
                항목유형 <span className="text-destructive">*</span>
              </Label>
              <Select
                defaultValue={editItem?.context_type ?? "그리드"}
                onValueChange={(v) => setValue("context_type", v as DictionaryContextType)}
              >
                <SelectTrigger id="context_type" aria-label="항목유형 선택">
                  <SelectValue />
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

            {/* 카테고리 */}
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-sm">
                카테고리 <span className="text-destructive">*</span>
              </Label>
              <Select
                defaultValue={editItem?.category ?? "공통"}
                onValueChange={(v) => setValue("category", v as DictionaryCategory)}
              >
                <SelectTrigger id="category" aria-label="카테고리 선택">
                  <SelectValue />
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

            {/* 설명 */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm">
                설명 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="용어에 대한 설명을 입력하세요 (최대 500자)"
                rows={4}
                className="resize-none"
                aria-describedby={errors.description ? "desc-error" : undefined}
                {...register("description")}
              />
              {errors.description && (
                <p id="desc-error" role="alert" className="text-xs text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* 푸터 버튼 */}
          <div className="flex justify-end gap-2 px-6 py-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : editItem ? "수정" : "추가"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
