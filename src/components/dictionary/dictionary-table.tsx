"use client";

import { Bot, User, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Dictionary, DictionaryCategory, DictionaryContextType } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, CONTEXT_TYPE_LABELS } from "./dummy-data";

interface DictionaryTableProps {
  items: Dictionary[];
  onEdit: (item: Dictionary) => void;
  onDelete: (item: Dictionary) => void;
}

export function DictionaryTable({ items, onEdit, onDelete }: DictionaryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" aria-label="단어사전 목록">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-36">용어명</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-24">항목유형</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-28">카테고리</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">설명</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-24">출처</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-28">등록일</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-20">관리</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={`${item.term}_${item.context_type}`}
              className={cn(
                "border-b last:border-0 transition-colors hover:bg-muted/30",
                index % 2 === 1 && "bg-muted/10"
              )}
            >
              {/* 용어명 */}
              <td className="px-4 py-3">
                <code className="font-mono text-xs font-medium bg-muted px-1.5 py-0.5 rounded">
                  {item.term}
                </code>
              </td>

              {/* 항목유형 */}
              <td className="px-4 py-3">
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {CONTEXT_TYPE_LABELS[item.context_type as DictionaryContextType] ?? item.context_type}
                </span>
              </td>

              {/* 카테고리 */}
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                    CATEGORY_COLORS[item.category as DictionaryCategory]
                  )}
                >
                  {CATEGORY_LABELS[item.category as DictionaryCategory] ?? item.category}
                </span>
              </td>

              {/* 설명 */}
              <td className="px-4 py-3 text-muted-foreground max-w-xs">
                <span className="line-clamp-2 text-xs leading-relaxed">{item.description}</span>
              </td>

              {/* 출처 뱃지 */}
              <td className="px-4 py-3">
                {item.source === "ai" ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Bot className="h-3 w-3" aria-hidden="true" />
                    AI 자동
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <User className="h-3 w-3" aria-hidden="true" />
                    수동
                  </Badge>
                )}
              </td>

              {/* 등록일 */}
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(item.created_at).toLocaleDateString("ko-KR")}
              </td>

              {/* 관리 버튼 */}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(item)}
                    aria-label={`${item.term} 수정`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(item)}
                    aria-label={`${item.term} 삭제`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 페이지네이션 ──────────────────────────────────────────────
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-1 pt-3">
      <p className="text-xs text-muted-foreground">
        {totalItems}개 중 {from}–{to}개 표시
      </p>
      <nav className="flex items-center gap-1" aria-label="페이지 탐색">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="이전 페이지"
        >
          ‹ 이전
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .reduce<(number | "…")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? "default" : "outline"}
                size="sm"
                className="h-7 w-7 p-0 text-xs"
                onClick={() => onPageChange(p as number)}
                aria-label={`${p}페이지`}
                aria-current={p === currentPage ? "page" : undefined}
              >
                {p}
              </Button>
            )
          )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="다음 페이지"
        >
          다음 ›
        </Button>
      </nav>
    </div>
  );
}
