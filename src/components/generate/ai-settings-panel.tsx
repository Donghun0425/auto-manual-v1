"use client";

import { useState } from "react";
import { Eye, EyeOff, Settings2, Cpu, Link2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { AiSettings } from "@/types";

interface AiSettingsPanelProps {
  settings: AiSettings;
  onChange: (partial: Partial<AiSettings>) => void;
}

export function AiSettingsPanel({ settings, onChange }: AiSettingsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const isProxy = settings.provider === "vscode-proxy";

  return (
    <div className="space-y-5">
      {/* 제공자 전환 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Label htmlFor="provider-toggle" className="text-sm font-medium cursor-pointer">
            {isProxy ? "VS Code 프록시 사용" : "Github API 사용"}
          </Label>
          <Badge variant={isProxy ? "default" : "secondary"} className="text-xs">
            {isProxy ? "프록시 모드" : "API 키 모드"}
          </Badge>
        </div>
        <Switch
          id="provider-toggle"
          checked={isProxy}
          onCheckedChange={(checked) =>
            onChange({ provider: checked ? "vscode-proxy" : "github" })
          }
          aria-label="VS Code 프록시 모드 전환"
        />
      </div>

      <Separator />

      {/* API 키 모드 */}
      {!isProxy && (
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
        <Label className="text-sm">AI 모델</Label>
        <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
          GPT-4o mini (빠름·저비용)
        </div>
      </div>
    </div>
  );
}
