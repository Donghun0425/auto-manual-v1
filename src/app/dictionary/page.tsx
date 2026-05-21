"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Bot, User, Info, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DictionaryTable, Pagination } from "@/components/dictionary/dictionary-table";
import { DictionaryFormModal } from "@/components/dictionary/dictionary-form-modal";
import { DeleteConfirmDialog } from "@/components/dictionary/delete-confirm-dialog";
import { ResetConfirmDialog } from "@/components/dictionary/reset-confirm-dialog";
import {
  CATEGORY_LABELS,
  CONTEXT_TYPE_LABELS,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from "@/components/dictionary/dummy-data";
import {
  listDictionary,
  upsertDictionary,
  updateDictionary,
  deleteDictionary,
  bulkDeleteDictionary,
  getDictionaryStats,
} from "@/lib/supabase/queries/dictionary";
import type { Dictionary, DictionaryCategory, DictionaryContextType } from "@/types";

type FilterCategory = DictionaryCategory | "all";
type FilterContextType = DictionaryContextType | "all";

interface Stats {
  total: number;
  aiCount: number;
  manualCount: number;
}

export default function DictionaryPage() {
  // ── 목록 상태 ────────────────────────────────────────────
  const [items, setItems] = useState<Dictionary[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, aiCount: 0, manualCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 필터 상태 ────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [contextTypeFilter, setContextTypeFilter] = useState<FilterContextType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  // ── 모달 상태 ────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Dictionary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dictionary | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);

  // 검색 디바운스 ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ── 데이터 로드 ───────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDictionary({
        search: debouncedSearch,
        category: categoryFilter,
        contextType: contextTypeFilter,
        page: currentPage,
        pageSize,
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "데이터 조회 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, contextTypeFilter, currentPage, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await getDictionaryStats();
      setStats(s);
    } catch {
      // 통계 오류는 조용히 처리 (목록 조회에 영향 없음)
    }
  }, []);

  // 필터 변경 시 목록 재조회
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 마운트 시 통계 조회 (뮤테이션 후에는 handleFormSubmit/handleDelete에서 직접 호출)
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── 검색 디바운스 ─────────────────────────────────────────
  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 350);
  }

  function handleCategoryChange(cat: FilterCategory) {
    setCategoryFilter(cat);
    setCurrentPage(1);
  }

  function handleContextTypeChange(ct: FilterContextType) {
    setContextTypeFilter(ct);
    setCurrentPage(1);
  }

  function handlePageSizeChange(size: PageSize) {
    setPageSize(size);
    setCurrentPage(1);
  }

  // ── CRUD 핸들러 ───────────────────────────────────────────
  async function handleFormSubmit(
    values: { term: string; context_type: DictionaryContextType; category: DictionaryCategory; description: string },
    original?: { term: string; context_type: DictionaryContextType }
  ) {
    setSubmitting(true);
    try {
      if (original) {
        await updateDictionary(original.term, original.context_type, values);
        toast.success(`"${values.term}" 용어가 수정되었습니다.`);
      } else {
        await upsertDictionary({ ...values, source: "manual" });
        toast.success(`"${values.term}" 용어가 등록되었습니다.`);
        setCurrentPage(1);
      }
      setFormOpen(false);
      setEditItem(null);
      await fetchItems();
      fetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDictionary(deleteTarget.term, deleteTarget.context_type);
      toast.success(`"${deleteTarget.term}" 용어가 삭제되었습니다.`);
      setDeleteTarget(null);
      // 현재 페이지가 마지막 항목이었다면 이전 페이지로
      const remainOnPage = items.length - 1;
      if (remainOnPage === 0 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else {
        await fetchItems();
      }
      fetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function handleReset(category: DictionaryCategory, contextType: DictionaryContextType) {
    setResetting(true);
    try {
      const count = await bulkDeleteDictionary(category, contextType);
      toast.success(`[${category} / ${contextType}] ${count}건이 삭제되었습니다.`);
      setResetOpen(false);
      setCurrentPage(1);
      await fetchItems();
      fetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "초기화 중 오류가 발생했습니다.";
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Container>
      <PageHeader
        title="단어사전 관리"
        description="용어와 설명을 관리하여 AI 생성 품질을 향상시키세요"
      />

      {/* 통계 요약 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">전체</span>
          <Badge variant="secondary">{stats.total}개</Badge>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5 text-sm">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">AI 자동</span>
          <Badge variant="secondary">{stats.aiCount}개</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">수동 등록</span>
          <Badge variant="secondary">{stats.manualCount}개</Badge>
        </div>
      </div>

      {/* 검색 + 필터 + 추가 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* 검색 */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            placeholder="용어명 또는 설명으로 검색..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            aria-label="용어 검색"
          />
        </div>

        {/* 카테고리 필터 */}
        <Select
          value={categoryFilter}
          onValueChange={(v) => handleCategoryChange(v as FilterCategory)}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="카테고리 필터">
            <SelectValue>
              {categoryFilter === "all"
                ? "전체 카테고리"
                : CATEGORY_LABELS[categoryFilter as DictionaryCategory] ?? categoryFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {(Object.entries(CATEGORY_LABELS) as [DictionaryCategory, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* 항목유형 필터 */}
        <Select
          value={contextTypeFilter}
          onValueChange={(v) => handleContextTypeChange(v as FilterContextType)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="항목유형 필터">
            <SelectValue>
              {contextTypeFilter === "all" ? "전체 항목유형" : contextTypeFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 항목유형</SelectItem>
            {(Object.keys(CONTEXT_TYPE_LABELS) as DictionaryContextType[]).map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 페이지 크기 */}
        <Select
          value={String(pageSize)}
          onValueChange={(v) => handlePageSizeChange(Number(v) as PageSize)}
        >
          <SelectTrigger className="w-full sm:w-24" aria-label="페이지당 표시 개수">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}개씩
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 초기화 버튼 */}
        <Button
          variant="destructive"
          onClick={() => setResetOpen(true)}
          className="shrink-0"
          aria-label="단어사전 초기화"
          disabled={loading}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" aria-hidden="true" />
          초기화
        </Button>

        {/* 추가 버튼 */}
        <Button
          onClick={() => { setEditItem(null); setFormOpen(true); }}
          className="shrink-0"
          aria-label="새 용어 추가"
          disabled={loading}
        >
          <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
          용어 추가
        </Button>
      </div>

      {/* 검색 결과 안내 */}
      {debouncedSearch && !loading && (
        <p className="text-xs text-muted-foreground mb-3">
          &ldquo;{debouncedSearch}&rdquo; 검색 결과: {total}개
        </p>
      )}

      {/* 오류 배너 */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 mb-4 px-4 py-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fetchItems()}
          >
            재시도
          </Button>
        </div>
      )}

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="text-sm">불러오는 중...</span>
            </div>
          ) : (
            <>
              <DictionaryTable
                items={items}
                onEdit={(item) => { setEditItem(item); setFormOpen(true); }}
                onDelete={(item) => setDeleteTarget(item)}
              />
              {total > 0 && (
                <>
                  <Separator />
                  <div className="px-4 pb-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      totalItems={total}
                      pageSize={pageSize}
                    />
                  </div>
                </>
              )}
              {total === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Info className="h-8 w-8 opacity-40" aria-hidden="true" />
                  <p className="text-sm">
                    {debouncedSearch || categoryFilter !== "all"
                      ? "검색 결과가 없습니다."
                      : "등록된 용어가 없습니다. 첫 번째 용어를 추가해보세요."}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 모달들 */}
      <DictionaryFormModal
        open={formOpen}
        editItem={editItem}
        onClose={() => { setFormOpen(false); setEditItem(null); }}
        onSubmit={handleFormSubmit}
        submitting={submitting}
      />
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        termName={deleteTarget?.term ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
      <ResetConfirmDialog
        open={resetOpen}
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
        loading={resetting}
      />
    </Container>
  );
}
