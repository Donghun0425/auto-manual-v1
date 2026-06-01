"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UdcTable, UdcPagination } from "@/components/udc-manager/udc-table";
import { UdcDetailSheet } from "@/components/udc-manager/udc-detail-sheet";
import { UdcUploadCard } from "@/components/udc-manager/udc-upload-card";
import {
  UDC_TYPE_LABELS,
  UDC_CATEGORY_LABELS,
  UDC_TYPE_OPTIONS,
  UDC_CATEGORY_OPTIONS,
} from "@/components/udc-manager/constants";
import type { UdcComponent, UdcComponentType, UdcCategory } from "@/types";

type FilterType = UdcComponentType | "all";
type FilterCategory = UdcCategory | "all";

interface ListResponse {
  data: UdcComponent[];
  total: number;
}

const PAGE_SIZE = 20;

export default function UdcManagerPage() {
  const [items, setItems] = useState<UdcComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [page, setPage] = useState(1);

  const [detailShortName, setDetailShortName] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({
        search: debouncedSearch,
        type: typeFilter,
        category: categoryFilter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/udc?${sp.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "목록 조회 실패");
      const r = body as ListResponse;
      setItems(r.data);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록 조회 실패");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, categoryFilter, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 검색 디바운스
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  function handleView(item: UdcComponent) {
    setDetailShortName(item.short_name);
    setDetailOpen(true);
  }

  return (
    <Container>
      <PageHeader
        title="UDC 관리"
        description="eXBuilder6 UDC(사용자 정의 컴포넌트) 분석 데이터를 관리합니다."
      />

      <div className="space-y-4">
        <UdcUploadCard onUploaded={fetchItems} />

        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="단축명·표시명·설명 검색"
                  className="pl-9"
                />
              </div>

              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v as FilterType);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="유형" />
                </SelectTrigger>
                <SelectContent>
                  {UDC_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "all" ? "전체 유형" : UDC_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v as FilterCategory);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  {UDC_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "all" ? "전체 카테고리" : UDC_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2" />
                불러오는 중…
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-destructive">
                <AlertCircle className="size-6 mb-2" />
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <>
                <UdcTable items={items} onView={handleView} />
                <UdcPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <UdcDetailSheet
        shortName={detailShortName}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </Container>
  );
}
