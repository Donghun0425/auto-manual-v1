"use client";

import { Play, AlertCircle, Loader2, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { GenerationProgress, OutputType } from "@/types";

// ── 간단한 프로그레스바 ────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="매뉴얼 생성 진행률"
      className="w-full h-2 bg-muted rounded-full overflow-hidden"
    >
      <div
        className="h-full bg-primary transition-all duration-300 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── 상태 뱃지 ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: GenerationProgress["status"] }) {
  const map: Record<
    GenerationProgress["status"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
  > = {
    idle: { label: "대기 중", variant: "secondary", icon: null },
    parsing: { label: "파싱 중", variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> },
    generating: { label: "생성 중", variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> },
    completed: { label: "완료", variant: "outline", icon: <CheckCircle2 className="h-3 w-3 text-green-500" aria-hidden="true" /> },
    error: { label: "오류", variant: "destructive", icon: <AlertCircle className="h-3 w-3" aria-hidden="true" /> },
  };
  const s = map[status];
  return (
    <Badge variant={s.variant} className="gap-1 text-xs">
      {s.icon}
      {s.label}
    </Badge>
  );
}

// ── GenerationPanel ───────────────────────────────────────────
interface GenerationPanelProps {
  selectedFileCount: number;
  outputFormats: OutputType[];
  useDictionary: boolean;
  progress: GenerationProgress;
  onOutputFormatChange: (format: OutputType, checked: boolean) => void;
  onDictionaryChange: (checked: boolean) => void;
  onGenerate: () => void;
}

export function GenerationPanel({
  selectedFileCount,
  outputFormats,
  useDictionary,
  progress,
  onOutputFormatChange,
  onDictionaryChange,
  onGenerate,
}: GenerationPanelProps) {
  const isRunning = progress.status === "parsing" || progress.status === "generating";
  const canGenerate = selectedFileCount > 0 && outputFormats.length > 0 && !isRunning;

  return (
    <div className="space-y-5">
      {/* 출력 형식 선택 */}
      <div className="space-y-2">
        <p className="text-sm font-medium">출력 형식</p>
        <div className="flex gap-5">
          {(["html", "md"] as OutputType[]).map((fmt) => (
            <div key={fmt} className="flex items-center gap-2">
              <Checkbox
                id={`fmt-${fmt}`}
                checked={outputFormats.includes(fmt)}
                onCheckedChange={(checked) =>
                  onOutputFormatChange(fmt, checked === true)
                }
                aria-label={`${fmt.toUpperCase()} 형식 포함`}
              />
              <Label htmlFor={`fmt-${fmt}`} className="text-sm cursor-pointer">
                {fmt === "html" ? "HTML 파일" : "Markdown 파일"}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* 생성 형식 */}
      <div className="space-y-2">
        <p className="text-sm font-medium">생성 형식</p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="use-dictionary"
            checked={useDictionary}
            onCheckedChange={(checked) => onDictionaryChange(checked === true)}
            aria-label="단어사전 활용"
          />
          <Label htmlFor="use-dictionary" className="text-sm cursor-pointer">
            단어사전 활용
          </Label>
        </div>
        {!useDictionary && (
          <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p>모든 항목은 단어사전을 활용하지 않고, 일괄 AI를 통해 생성합니다.</p>
              <p>AI로 생성된 결과가 단어사전에 저장되지 않습니다.</p>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* 선택 요약 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">선택된 파일</span>
        <span className={cn("font-medium", selectedFileCount === 0 && "text-muted-foreground")}>
          {selectedFileCount}개
        </span>
      </div>

      {/* 생성 버튼 */}
      <Button
        size="lg"
        className="w-full gap-2"
        disabled={!canGenerate}
        onClick={onGenerate}
        aria-label={`선택한 ${selectedFileCount}개 파일로 매뉴얼 생성`}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            생성 중...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" aria-hidden="true" />
            매뉴얼 생성
          </>
        )}
      </Button>

      {/* 유효성 안내 */}
      {selectedFileCount === 0 && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          파일 트리에서 분석할 파일을 1개 이상 선택하세요.
        </p>
      )}
      {outputFormats.length === 0 && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          출력 형식을 1개 이상 선택하세요.
        </p>
      )}

      {/* 진행률 (생성 중이거나 완료 시) */}
      {progress.status !== "idle" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">진행 상황</p>
            <StatusBadge status={progress.status} />
          </div>

          <ProgressBar value={progress.processedFiles} max={progress.totalFiles} />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.processedFiles} / {progress.totalFiles} 파일
            </span>
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" aria-hidden="true" />
              {progress.totalTokens.toLocaleString()} tokens
            </span>
          </div>

          {progress.currentFile && (
            <p className="text-xs text-muted-foreground truncate">
              처리 중: <span className="text-foreground font-medium">{progress.currentFile}</span>
            </p>
          )}

          {progress.errors.length > 0 && (
            <ul className="space-y-1" aria-label="생성 오류 목록">
              {progress.errors.map((err, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{err.fileName}: {err.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
