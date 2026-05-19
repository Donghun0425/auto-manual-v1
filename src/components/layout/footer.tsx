import Link from "next/link"
import { Building2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function Footer() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* 브랜드 */}
          <div className="flex flex-col gap-2">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <div className="bg-blue-600 text-white flex size-8 items-center justify-center rounded-md">
                <Building2 className="size-5" />
              </div>
              <span className="text-blue-600 dark:text-blue-400">ACANET</span>
            </Link>
            <p className="text-muted-foreground max-w-xs text-sm">
              대학정보화서비스 전문기업<br />
              CLX 매뉴얼 자동생성기
            </p>
          </div>

          {/* 링크 그룹 */}
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">페이지</p>
              <nav className="flex flex-col gap-1.5">
                {[
                  { label: "홈", href: "/" },
                  { label: "매뉴얼 생성", href: "/generate" },
                  { label: "단어사전", href: "/dictionary" },
                  { label: "레이아웃 관리", href: "/layout-manager" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">연락처</p>
              <nav className="flex flex-col gap-1.5">
                <a
                  href="http://www.acanet.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  회사 홈페이지
                </a>
                <a
                  href="mailto:acanet001@acanet.kr"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  고객문의
                </a>
              </nav>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <p className="text-muted-foreground text-center text-sm">
          © {new Date().getFullYear()} 아카넷. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
