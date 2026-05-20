"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <Container className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">오류가 발생했습니다</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || "예상치 못한 오류가 발생했습니다. 다시 시도해주세요."}
        </p>
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RotateCcw className="h-4 w-4" />
        다시 시도
      </Button>
    </Container>
  );
}
