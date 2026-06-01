"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Moon, Sun, Menu, Building2, ChevronDown } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const topNavItems = [
  { label: "홈", href: "/" },
  { label: "단어사전", href: "/dictionary" },
  { label: "UDC 관리", href: "/udc-manager" },
  { label: "레이아웃 관리", href: "/layout-manager" },
]

const generateSubItems = [
  { label: "매뉴얼 결과", href: "/result" },
  { label: "매뉴얼 생성 결과 비교", href: "/compare" },
  { label: "매뉴얼 생성 이력", href: "/history" },
  { label: "매뉴얼 이미지 관리", href: "/image-manager" },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="테마 전환"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [mobileGenerateOpen, setMobileGenerateOpen] = React.useState(false)

  const isGenerateActive =
    pathname === "/generate" ||
    generateSubItems.some((item) => pathname === item.href)

  return (
    <header className="bg-background/80 supports-backdrop-filter:backdrop-blur-md sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2 font-bold">
          <div className="bg-blue-600 text-white flex size-8 items-center justify-center rounded-md">
            <Building2 className="size-5" />
          </div>
          <span className="text-blue-600 dark:text-blue-400">ACANET</span>
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden items-center gap-1 md:flex">
          {/* 홈 */}
          <Link
            href="/"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              pathname === "/" ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
          >
            홈
          </Link>

          {/* 매뉴얼 생성 (드롭다운) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                    isGenerateActive ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  매뉴얼 생성
                  <ChevronDown className="size-3.5" />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-[160px]">
              <DropdownMenuItem
                className={cn(pathname === "/generate" && "bg-accent")}
                onClick={() => router.push("/generate")}
              >
                매뉴얼 생성
              </DropdownMenuItem>
              <div className="my-1 h-px bg-border" />
              {generateSubItems.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  className={cn(pathname === item.href && "bg-accent")}
                  onClick={() => router.push(item.href)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 나머지 최상위 메뉴 */}
          {topNavItems.slice(1).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 우측 액션 */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* 모바일 메뉴 */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">메뉴 열기</span>
                </Button>
              }
            />
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="bg-blue-600 text-white flex size-8 items-center justify-center rounded-md">
                    <Building2 className="size-5" />
                  </div>
                  ACANET
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1 px-2">
                {/* 홈 */}
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                    pathname === "/" ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  홈
                </Link>

                {/* 매뉴얼 생성 (아코디언) */}
                <button
                  onClick={() => setMobileGenerateOpen((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                    isGenerateActive ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  매뉴얼 생성
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      mobileGenerateOpen && "rotate-180"
                    )}
                  />
                </button>

                {mobileGenerateOpen && (
                  <div className="ml-3 flex flex-col gap-0.5 border-l pl-3">
                    <Link
                      href="/generate"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                        pathname === "/generate"
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      매뉴얼 생성
                    </Link>
                    {generateSubItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                          pathname === item.href
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}

                {/* 나머지 최상위 메뉴 */}
                {topNavItems.slice(1).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                      pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
