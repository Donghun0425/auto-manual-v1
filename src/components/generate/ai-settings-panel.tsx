"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Settings2, Cpu, Link2, RefreshCw, Server } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiSettings, AiModel, AiProvider } from "@/types";

interface AiSettingsPanelProps {
  settings: AiSettings;
  onChange: (partial: Partial<AiSettings>) => void;
}

interface ProxyModel {
  family: string;
  id: string;
}

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "github", label: "GitHub API" },
  { value: "vscode-proxy", label: "VS Code 프록시" },
  { value: "internal", label: "내부 AI 서버" },
];

export function AiSettingsPanel({ settings, onChange }: AiSettingsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [proxyModels, setProxyModels] = useState<ProxyModel[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");

  const isProxy = settings.provider === "vscode-proxy";
  const isInternal = settings.provider === "internal";

  // 프록시 URL이 바뀌거나 프록시 모드로 전환될 때 모델 목록 조회
  useEffect(() => {
    if (!isProxy) return;
    fetchProxyModels(settings.proxyUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProxy, settings.proxyUrl]);

  async function fetchProxyModels(proxyUrl: string) {
    setModelLoading(true);
    setModelError("");
    try {
      const base = proxyUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const seen = new Set<string>(); //2026.06.02 KHJ추가
      const items: ProxyModel[] = (json.data ?? [])
        .map((m: Record<string, string>) => ({ family: m.family ?? m.id, id: m.id }))
        .filter((m: ProxyModel) => m.family.startsWith("gpt-4") || m.family.startsWith("gpt-5")) //2026.06.02 KHJ gpt 5추가 수정
        .filter((m: ProxyModel) => {//2026.06.02 KHJ 중복모델 제거 추가 1
          if (seen.has(m.family)) return false;
          seen.add(m.family);
          return true;
        });
      setProxyModels(items);
      // 현재 선택된 모델이 목록에 없으면 첫 번째로 리셋
      if (items.length > 0 && !items.find((m) => m.family === settings.model)) {
        onChange({ model: items[0].family as AiModel });
      }
    } catch {
      setModelError("모델 목록 조회 실패 — 프록시 서버가 실행 중인지 확인하세요.");
      setProxyModels([]);
    } finally {
      setModelLoading(false);
    }
  }

  function handleProviderChange(provider: AiProvider) {
    const update: Partial<AiSettings> = { provider };
    // internal 선택 시 모델을 gemma4-31b로 고정
    if (provider === "internal") {
      update.model = "gemma4-31b";
    } else if (provider === "github") {
      update.model = "gpt-4o-mini";
    }
    onChange(update);
  }

  return (
    <div className="space-y-5">
      {/* 제공자 선택 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Label className="text-sm font-medium">AI 제공자</Label>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleProviderChange(opt.value)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                settings.provider === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* GitHub API 키 모드 */}
      {settings.provider === "github" && (
        <div className="space-y-2">
          <Label htmlFor="api-key" className="flex items-center gap-1.5 text-sm">
            <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
            GitHub Models API 키
          </Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showApiKey ? "text" : "password"}
              value={settings.apiKey ?? ""}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="pr-10 font-mono text-sm"
              autoComplete="off"
              aria-describedby="api-key-hint"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowApiKey((v) => !v)}
              aria-label={showApiKey ? "API 키 숨기기" : "API 키 표시"}
            >
              {showApiKey ? (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>
          <p id="api-key-hint" className="text-xs text-muted-foreground">
            키는 브라우저 localStorage에만 저장됩니다.
          </p>
        </div>
      )}

      {/* 내부 AI 서버 설정 */}
      {isInternal && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="internal-api-key" className="flex items-center gap-1.5 text-sm">
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              내부 AI 서버 API 키
            </Label>
            <div className="relative">
              <Input
                id="internal-api-key"
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey ?? ""}
                onChange={(e) => onChange({ apiKey: e.target.value })}
                placeholder="app-xxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-sm"
                autoComplete="off"
                aria-describedby="internal-key-hint"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowApiKey((v) => !v)}
                aria-label={showApiKey ? "API 키 숨기기" : "API 키 표시"}
              >
                {showApiKey ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p id="internal-key-hint" className="text-xs text-muted-foreground">
              키는 브라우저 localStorage에만 저장됩니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal-base-url" className="flex items-center gap-1.5 text-sm">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              Base URL
            </Label>
            <Input
              id="internal-base-url"
              type="text"
              value={settings.internalBaseUrl}
              onChange={(e) => onChange({ internalBaseUrl: e.target.value })}
              placeholder="http://192.168.71.125/v1"
              className="font-mono text-sm"
            />
          </div>
        </div>
      )}

      {/* 프록시 URL (프록시 모드일 때) */}
      {isProxy && (
        <div className="space-y-2">
          <Label htmlFor="proxy-url" className="flex items-center gap-1.5 text-sm">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            프록시 URL
          </Label>
          <Input
            id="proxy-url"
            type="text"
            value={settings.proxyUrl}
            onChange={(e) => onChange({ proxyUrl: e.target.value })}
            placeholder="http://localhost:3100"
            className="font-mono text-sm"
            aria-describedby="proxy-url-hint"
          />
          <p id="proxy-url-hint" className="text-xs text-muted-foreground">
            VS Code Extension이 실행 중이어야 합니다.
          </p>
        </div>
      )}

      {/* AI 모델 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">AI 모델</Label>
          {isProxy && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchProxyModels(settings.proxyUrl)}
              disabled={modelLoading}
              aria-label="모델 목록 새로고침"
            >
              <RefreshCw className={`h-3 w-3 ${modelLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
        {isProxy ? (
          modelError ? (
            <div className="flex h-9 w-full items-center rounded-md border border-destructive/50 bg-destructive/10 px-3 text-xs text-destructive">
              {modelError}
            </div>
          ) : (
            <Select
              value={settings.model}
              onValueChange={(v) => onChange({ model: v as AiModel })}
              disabled={modelLoading || proxyModels.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={modelLoading ? "로딩 중..." : "모델 선택"} />
              </SelectTrigger>
              <SelectContent>
                {proxyModels.map((m) => (
                  <SelectItem key={m.family} value={m.family}>
                    {m.family}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : isInternal ? (
          <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            gemma4-31b
          </div>
        ) : (
          <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            GPT-4o mini (빠름·저비용)
          </div>
        )}
      </div>
    </div>
  );
}
