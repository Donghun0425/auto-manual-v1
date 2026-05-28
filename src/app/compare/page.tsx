"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, Trash2, Eye, AlignLeft, Diff, FileCode2, Clock, Zap, Hash } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SideBySidePreview } from "@/components/compare/side-by-side-preview";
import { DiffView } from "@/components/compare/diff-view";
import { useCompareStore } from "@/stores/compare-store";
import type { ManualResult, GenerationResult, AiUsage } from "@/types";

const LEFT_LABEL = "VS Code 프록시";
const RIGHT_LABEL = "내부 AI (Gemma)";

function fmtDuration(ms: number) {
  return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "-";
}

function fmtTokens(n: number) {
  return n.toLocaleString();
}

export default function ComparePage() {
  const router = useRouter();
  const { vsCodeProxyResult, internalResult, clearResult, clearAll } = useCompareStore();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const leftFiles = vsCodeProxyResult?.results ?? [];
  const rightFiles = internalResult?.results ?? [];

  const commonFileNames = leftFiles
    .map((f) => f.fileName)
    .filter((name) => rightFiles.some((f) => f.fileName === name));

  const activeFileName = selectedFile ?? commonFileNames[0] ?? null;

  const leftResult: ManualResult | undefined = leftFiles.find((f) => f.fileName === activeFileName);
  const rightResult: ManualResult | undefined = rightFiles.find((f) => f.fileName === activeFileName);

  const hasBothResults = !!vsCodeProxyResult && !!internalResult;
  const hasCommonFiles = commonFileNames.length > 0;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Container>
      <PageHeader
        title="생성결과 비교"
        description="VS Code 프록시와 내부 AI (Gemma)의 생성 결과를 나란히 비교합니다"
      />

      {/* 결과 상태 카드 */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <ResultStatusCard
          label={LEFT_LABEL}
          result={vsCodeProxyResult}
          formatDate={formatDate}
          onClear={() => clearResult("vscode-proxy")}
          colorClass="blue"
        />
        <ResultStatusCard
          label={RIGHT_LABEL}
          result={internalResult}
          formatDate={formatDate}
          onClear={() => clearResult("internal")}
          colorClass="orange"
        />
      </div>

      {/* 전체 통계 비교 패널 */}
      {hasBothResults && (
        <StatsPanel
          left={vsCodeProxyResult}
          right={internalResult}
          leftLabel={LEFT_LABEL}
          rightLabel={RIGHT_LABEL}
        />
      )}

      {/* 결과 없을 때 안내 */}
      {!hasBothResults && (
        <div className="flex flex-col items-center justify-center gap-4 min-h-[320px] text-center border rounded-lg bg-muted/20">
          <GitCompare className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="text-base font-medium">두 가지 결과가 모두 필요합니다</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
              VS Code 프록시와 내부 AI(Gemma)로 각각 매뉴얼을 생성한 후,
              결과 페이지에서 <strong>&quot;비교용으로 저장&quot;</strong>을 클릭하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/generate")}>
              매뉴얼 생성하기
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/result")}>
              결과 페이지 이동
            </Button>
          </div>
        </div>
      )}

      {/* 공통 파일 없을 때 안내 */}
      {hasBothResults && !hasCommonFiles && (
        <div className="flex flex-col items-center justify-center gap-3 min-h-[160px] text-center border rounded-lg bg-muted/20">
          <FileCode2 className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium">공통 파일이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">
              두 결과에서 동일한 파일명이 없어 비교할 수 없습니다.
            </p>
          </div>
        </div>
      )}

      {/* 비교 영역 */}
      {hasBothResults && hasCommonFiles && (
        <div className="space-y-4">
          {/* 파일 선택 + 전체 초기화 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">비교 파일</span>
              <Select value={activeFileName ?? ""} onValueChange={setSelectedFile}>
                <SelectTrigger className="w-[280px] text-sm h-8">
                  <SelectValue placeholder="파일 선택" />
                </SelectTrigger>
                <SelectContent>
                  {commonFileNames.map((name) => (
                    <SelectItem key={name} value={name} className="text-sm">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs">
                공통 {commonFileNames.length}개
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={clearAll}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              전체 초기화
            </Button>
          </div>

          {/* 파일별 토큰 비교 */}
          {leftResult && rightResult && (
            <FileTokenStats
              leftResult={leftResult}
              rightResult={rightResult}
              leftLabel={LEFT_LABEL}
              rightLabel={RIGHT_LABEL}
            />
          )}

          {/* 비교 탭 */}
          {leftResult && rightResult && (
            <Tabs defaultValue="html" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="html" className="gap-1.5 text-xs sm:text-sm">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  HTML 비교
                </TabsTrigger>
                <TabsTrigger value="markdown" className="gap-1.5 text-xs sm:text-sm">
                  <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Markdown 비교
                </TabsTrigger>
                <TabsTrigger value="diff" className="gap-1.5 text-xs sm:text-sm">
                  <Diff className="h-3.5 w-3.5" aria-hidden="true" />
                  Diff 뷰
                </TabsTrigger>
              </TabsList>

              <TabsContent value="html">
                {leftResult.htmlContent && rightResult.htmlContent ? (
                  <SideBySidePreview
                    leftContent={leftResult.htmlContent}
                    rightContent={rightResult.htmlContent}
                    leftLabel={LEFT_LABEL}
                    rightLabel={RIGHT_LABEL}
                    mode="html"
                  />
                ) : (
                  <EmptyState message="HTML 내용이 없습니다. 생성 시 HTML 형식을 포함해야 합니다." />
                )}
              </TabsContent>

              <TabsContent value="markdown">
                {leftResult.markdownContent && rightResult.markdownContent ? (
                  <SideBySidePreview
                    leftContent={leftResult.markdownContent}
                    rightContent={rightResult.markdownContent}
                    leftLabel={LEFT_LABEL}
                    rightLabel={RIGHT_LABEL}
                    mode="markdown"
                  />
                ) : (
                  <EmptyState message="Markdown 내용이 없습니다. 생성 시 Markdown 형식을 포함해야 합니다." />
                )}
              </TabsContent>

              <TabsContent value="diff">
                <Tabs defaultValue="diff-md">
                  <TabsList className="mb-3 h-8">
                    <TabsTrigger value="diff-md" className="text-xs">Markdown Diff</TabsTrigger>
                    <TabsTrigger value="diff-html" className="text-xs">HTML Diff</TabsTrigger>
                  </TabsList>
                  <TabsContent value="diff-md">
                    {leftResult.markdownContent && rightResult.markdownContent ? (
                      <DiffView
                        leftContent={leftResult.markdownContent}
                        rightContent={rightResult.markdownContent}
                        leftLabel={LEFT_LABEL}
                        rightLabel={RIGHT_LABEL}
                      />
                    ) : (
                      <EmptyState message="Markdown 내용이 없어 Diff를 표시할 수 없습니다." />
                    )}
                  </TabsContent>
                  <TabsContent value="diff-html">
                    {leftResult.htmlContent && rightResult.htmlContent ? (
                      <DiffView
                        leftContent={leftResult.htmlContent}
                        rightContent={rightResult.htmlContent}
                        leftLabel={LEFT_LABEL}
                        rightLabel={RIGHT_LABEL}
                      />
                    ) : (
                      <EmptyState message="HTML 내용이 없어 Diff를 표시할 수 없습니다." />
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </Container>
  );
}

interface StatsPanelProps {
  left: GenerationResult;
  right: GenerationResult;
  leftLabel: string;
  rightLabel: string;
}

function StatsPanel({ left, right, leftLabel, rightLabel }: StatsPanelProps) {
  const rows: { icon: React.ReactNode; label: string; leftVal: string; rightVal: string }[] = [
    {
      icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
      label: "생성 소요시간",
      leftVal: fmtDuration(left.duration),
      rightVal: fmtDuration(right.duration),
    },
    {
      icon: <Zap className="h-3.5 w-3.5 text-muted-foreground" />,
      label: "총 토큰",
      leftVal: fmtTokens(left.totalTokenUsage.total_tokens),
      rightVal: fmtTokens(right.totalTokenUsage.total_tokens),
    },
    {
      icon: <Hash className="h-3.5 w-3.5 text-muted-foreground" />,
      label: "프롬프트 토큰",
      leftVal: fmtTokens(left.totalTokenUsage.prompt_tokens),
      rightVal: fmtTokens(right.totalTokenUsage.prompt_tokens),
    },
    {
      icon: <Hash className="h-3.5 w-3.5 text-muted-foreground" />,
      label: "완성 토큰",
      leftVal: fmtTokens(left.totalTokenUsage.completion_tokens),
      rightVal: fmtTokens(right.totalTokenUsage.completion_tokens),
    },
  ];

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm text-muted-foreground font-medium">전체 생성 통계 비교</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-[1fr_1fr_1fr] text-xs font-semibold text-muted-foreground mb-2 px-1">
          <span>항목</span>
          <span className="text-blue-600 dark:text-blue-400">{leftLabel}</span>
          <span className="text-orange-600 dark:text-orange-400">{rightLabel}</span>
        </div>
        <Separator className="mb-2" />
        <div className="space-y-1.5">
          {rows.map((row) => {
            const leftNum = parseFloat(row.leftVal.replace(/,/g, ""));
            const rightNum = parseFloat(row.rightVal.replace(/,/g, ""));
            const diff = !isNaN(leftNum) && !isNaN(rightNum) ? rightNum - leftNum : null;
            return (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr_1fr] items-center px-1 py-1 rounded hover:bg-muted/40 text-sm"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  {row.icon}
                  {row.label}
                </span>
                <span className="font-mono font-medium text-blue-700 dark:text-blue-300">
                  {row.leftVal}
                </span>
                <span className="flex items-center gap-2 font-mono font-medium text-orange-700 dark:text-orange-300">
                  {row.rightVal}
                  {diff !== null && diff !== 0 && (
                    <span
                      className={`text-xs font-normal ${
                        diff > 0
                          ? "text-red-500 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-2 px-1">
          * 차이(±)는 내부 AI 기준. 양수(+)는 내부 AI가 더 많이 사용.
        </p>
      </CardContent>
    </Card>
  );
}

interface FileTokenStatsProps {
  leftResult: ManualResult;
  rightResult: ManualResult;
  leftLabel: string;
  rightLabel: string;
}

function FileTokenStats({ leftResult, rightResult, leftLabel, rightLabel }: FileTokenStatsProps) {
  const left: AiUsage = leftResult.tokenUsage;
  const right: AiUsage = rightResult.tokenUsage;

  const rows: { label: string; leftVal: number; rightVal: number }[] = [
    { label: "총 토큰", leftVal: left.total_tokens, rightVal: right.total_tokens },
    { label: "프롬프트", leftVal: left.prompt_tokens, rightVal: right.prompt_tokens },
    { label: "완성", leftVal: left.completion_tokens, rightVal: right.completion_tokens },
  ];

  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <FileCode2 className="h-3.5 w-3.5" />
          파일별 토큰 사용량 — {leftResult.fileName}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-[1fr_1fr_1fr] text-[11px] font-semibold text-muted-foreground mb-1.5 px-1">
          <span>항목</span>
          <span className="text-blue-600 dark:text-blue-400">{leftLabel}</span>
          <span className="text-orange-600 dark:text-orange-400">{rightLabel}</span>
        </div>
        <div className="space-y-1">
          {rows.map((row) => {
            const diff = row.rightVal - row.leftVal;
            return (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr_1fr] items-center px-1 py-0.5 rounded text-xs"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono font-medium text-blue-700 dark:text-blue-300">
                  {fmtTokens(row.leftVal)}
                </span>
                <span className="flex items-center gap-2 font-mono font-medium text-orange-700 dark:text-orange-300">
                  {fmtTokens(row.rightVal)}
                  {diff !== 0 && (
                    <span
                      className={`text-[10px] font-normal ${
                        diff > 0 ? "text-red-500" : "text-green-600"
                      }`}
                    >
                      {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface ResultStatusCardProps {
  label: string;
  result: { results: ManualResult[]; generatedAt: string } | null;
  formatDate: (d: string) => string;
  onClear: () => void;
  colorClass: "blue" | "orange";
}

function ResultStatusCard({ label, result, formatDate, onClear, colorClass }: ResultStatusCardProps) {
  const colorMap = {
    blue: {
      border: "border-blue-200 dark:border-blue-800",
      dot: "bg-blue-500",
      dotEmpty: "bg-muted-foreground/30",
      badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    },
    orange: {
      border: "border-orange-200 dark:border-orange-800",
      dot: "bg-orange-500",
      dotEmpty: "bg-muted-foreground/30",
      badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
    },
  }[colorClass];

  return (
    <Card className={`border ${colorMap.border}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${result ? colorMap.dot : colorMap.dotEmpty}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {result ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorMap.badge}`}>
                {result.results.length}개 파일
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(result.generatedAt)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              삭제
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">저장된 결과 없음</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border rounded-lg bg-muted/30 min-h-[200px] flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}