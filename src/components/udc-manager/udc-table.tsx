"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UdcComponent, UdcComponentType, UdcCategory } from "@/types";
import { UDC_TYPE_LABELS, UDC_TYPE_COLORS, UDC_CATEGORY_LABELS } from "./constants";

interface UdcTableProps {
  items: UdcComponent[];
  onView: (item: UdcComponent) => void;
}

export function UdcTable({ items, onView }: UdcTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" aria-label="UDC 목록">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-44">단축명</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground w-48">표시명</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-28">유형</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-24">카테고리</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">설명</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap w-20">상세</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              className={cn(
                "border-b last:border-0 transition-colors hover:bg-muted/30",
                index % 2 === 1 && "bg-muted/10"
              )}
            >
              <td className="px-4 py-3">
                <code className="font-mono text-xs font-medium bg-muted px-1.5 py-0.5 rounded">
                  {item.short_name}
                </code>
              </td>
              <td className="px-4 py-3 font-medium">{item.display_name}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                    UDC_TYPE_COLORS[item.component_type as UdcComponentType]
                  )}
                >
                  {UDC_TYPE_LABELS[item.component_type as UdcComponentType] ?? item.component_type}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {UDC_CATEGORY_LABELS[item.category as UdcCategory] ?? item.category}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground max-w-xs">
                <span className="line-clamp-2 text-xs leading-relaxed">
                  {item.description ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onView(item)}
                  aria-label={`${item.short_name} 상세 보기`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          등록된 UDC 가 없습니다. udc.js 파일을 업로드하세요.
        </div>
      )}
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function UdcPagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
      <span className="text-muted-foreground">
        총 {total}건 · {page}/{totalPages} 페이지
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          이전
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
