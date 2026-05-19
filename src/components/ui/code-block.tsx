"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CodeBlockProps {
  code: string
  className?: string
}

export function CodeBlock({ code, className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("group relative", className)}>
      <pre className="bg-muted overflow-x-auto rounded-b-xl p-4 text-xs leading-relaxed">
        <code className="text-foreground">{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="코드 복사"
      >
        {copied ? (
          <Check className="size-3.5 text-green-500" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  )
}
