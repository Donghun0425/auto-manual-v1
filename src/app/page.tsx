import Link from "next/link";
import {
  FileText,
  BookOpen,
  Layout,
  ArrowRight,
  FileCode2,
  Zap,
  Download,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Container } from "@/components/layout/container";

const features = [
  {
    title: "매뉴얼 생성",
    description:
      ".clx.js 파일을 업로드하면 AI가 화면개요·CRUD·그리드·팝업 등 11개 항목을 분석하여 HTML/Markdown 매뉴얼을 자동으로 생성합니다.",
    icon: FileText,
    href: "/generate",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderHover: "hover:border-blue-300 dark:hover:border-blue-700",
    badge: "핵심 기능",
    badgeVariant: "default" as const,
    features: ["단일·다중·폴더 업로드", "파일 트리 체크박스 선택", "진행률 실시간 표시"],
  },
  {
    title: "단어사전 관리",
    description:
      "자주 사용하는 용어와 설명을 사전에 등록해두면 AI 호출 없이 일관된 설명을 재사용할 수 있어 비용을 절감하고 품질을 높입니다.",
    icon: BookOpen,
    href: "/dictionary",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderHover: "hover:border-green-300 dark:hover:border-green-700",
    badge: "DB 연동",
    badgeVariant: "secondary" as const,
    features: ["용어 CRUD 관리", "카테고리별 필터", "AI 자동 등록 구분"],
  },
  {
    title: "레이아웃 관리",
    description:
      "매뉴얼에 포함할 섹션을 선택하고 순서를 드래그로 조정하세요. 프리셋을 저장해두면 다음 생성 시 바로 적용할 수 있습니다.",
    icon: Layout,
    href: "/layout-manager",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderHover: "hover:border-purple-300 dark:hover:border-purple-700",
    badge: "커스터마이징",
    badgeVariant: "secondary" as const,
    features: ["섹션 포함/제외 토글", "드래그앤드롭 정렬", "프리셋 저장/불러오기"],
  },
];

const recentHistory = [
  {
    id: "1",
    fileName: "SAM_학생등록관리.clx.js",
    outputType: "HTML + MD",
    status: "completed",
    tokenUsage: 1_240,
    createdAt: "2026-05-19 14:32",
  },
  {
    id: "2",
    fileName: "FIN_수강료납부현황.clx.js",
    outputType: "HTML",
    status: "completed",
    tokenUsage: 980,
    createdAt: "2026-05-19 11:05",
  },
  {
    id: "3",
    fileName: "ADM_공지사항관리.clx.js",
    outputType: "MD",
    status: "completed",
    tokenUsage: 760,
    createdAt: "2026-05-18 16:48",
  },
];

const stats = [
  {
    label: "분석 카테고리",
    value: "10",
    unit: "개",
    detail: "화면개요·CRUD·그리드·팝업·탭 등",
  },
  {
    label: "출력 형식",
    value: "2",
    unit: "가지",
    detail: "HTML 파일 · Markdown 파일",
  },
  {
    label: "지원 AI 모델",
    value: "4",
    unit: "개",
    detail: "GPT-4o · GPT-4.1 시리즈",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <Container className="flex flex-col items-center gap-6 text-center">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium">
            <Zap className="h-3 w-3" />
            exBuilder6 전용 매뉴얼 자동화 도구
          </Badge>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            CLX 매뉴얼 자동생성기
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm sm:text-base leading-relaxed whitespace-nowrap">
            .clx.js 파일을 업로드하면 AI가 화면을 분석하여{" "}
            <span className="text-foreground font-medium">HTML·Markdown 사용자 매뉴얼</span>을 자동으로 만들어 드립니다.
          </p>
          <div className="flex flex-wrap justify-center gap-10 mt-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold text-primary">{stat.value}</span>
                  <span className="text-xs font-bold text-primary">{stat.unit}</span>
                </div>
                <span className="text-muted-foreground text-xs">{stat.label}</span>
                <span className="text-muted-foreground/70 text-xs">{stat.detail}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* 기능 카드 */}
      <section className="pb-16">
        <Container>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.href}
                  href={feature.href}
                  className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  aria-label={`${feature.title} 페이지로 이동`}
                >
                  <Card
                    className={`h-full border-2 transition-all duration-200 hover:shadow-lg ${feature.borderHover}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-11 h-11 ${feature.bgColor} rounded-lg flex items-center justify-center`}
                          aria-hidden="true"
                        >
                          <Icon className={`w-5 h-5 ${feature.color}`} />
                        </div>
                        <Badge variant={feature.badgeVariant} className="text-xs">
                          {feature.badge}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg font-semibold">{feature.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed mt-1">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <ul className="space-y-1.5" aria-label={`${feature.title} 주요 기능`}>
                        {feature.features.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <span className={`${feature.color} font-medium flex items-center gap-1.5 text-sm group-hover:gap-2.5 transition-all`}>
                        시작하기
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* 최근 생성 히스토리 */}
      <section className="pb-20">
        <Container>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-base font-semibold">최근 생성 히스토리</h2>
              <Badge variant="outline" className="text-xs">더미 데이터</Badge>
            </div>
            <Link
              href="/result"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              aria-label="전체 결과 보기"
            >
              전체 보기 <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <ul role="list" aria-label="최근 생성 히스토리 목록">
                {recentHistory.map((item, index) => (
                  <li key={item.id}>
                    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileCode2 className="h-4 w-4 text-blue-500 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.fileName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.createdAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <Badge variant="secondary" className="text-xs hidden sm:flex gap-1">
                          <Download className="h-3 w-3" aria-hidden="true" />
                          {item.outputType}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden md:block">
                          {item.tokenUsage.toLocaleString()} tokens
                        </span>
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200 dark:border-green-800">
                          완료
                        </Badge>
                      </div>
                    </div>
                    {index < recentHistory.length - 1 && <Separator />}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Container>
      </section>
    </div>
  );
}
