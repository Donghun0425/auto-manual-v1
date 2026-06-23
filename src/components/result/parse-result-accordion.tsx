"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Database,
  ShieldCheck,
  Grid3X3,
  Filter,
  Info,
  Layers,
  MousePointer2,
  Package,
  ClipboardList,
} from "lucide-react";
import { ArrowLeft, CornerDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClxParseResult, ManualResult } from "@/types";

/** 화면 간 이동 네비게이션 (탭/팝업 상호 링크) */
export interface ScreenNav {
  results: ManualResult[];
  resolveIndexByUri: (uri: string) => number | undefined;
  onNavigate: (index: number) => void;
  /** 현재 화면이 자식(탭/팝업)일 때 부모(메인) 인덱스 */
  parentIndex?: number;
  parentLabel?: string;
}

// ── 아코디언 섹션 래퍼 ────────────────────────────────────────
interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ id, icon, title, badge, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
          <span className="text-sm font-medium">{title}</span>
          {badge !== undefined && badge !== 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {badge}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div id={`section-${id}`} className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ── 공통 테이블 ───────────────────────────────────────────────
function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-b last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function splitWorkflow(flowLines: string[]): string[] {
  return flowLines
    .flatMap((line) => line.split(/\s*(?:->|→|➜|⇒)\s*/))
    .map((step) => step.trim())
    .filter(Boolean);
}

function normalizeStep(value: string): string {
  return value.replace(/\s+/g, "").replace(/[()[\]{}<>]/g, "").toLowerCase();
}

function currentScreenNames(result: ClxParseResult): string[] {
  const names = [
    result.overview.appTitle,
    result.overview.programName,
    result.overview.programName.split(">").pop(),
    result.filePath.split(/[\\/]/).pop()?.replace(/\.clx\.js$/i, ""),
  ];
  return names.filter((name): name is string => !!name && !!name.trim()).map(normalizeStep);
}

function isCurrentWorkflowStep(step: string, currentNames: string[]): boolean {
  const normalizedStep = normalizeStep(step);
  return currentNames.some((name) =>
    normalizedStep === name ||
    (name.length >= 3 && normalizedStep.includes(name)) ||
    (normalizedStep.length >= 3 && name.includes(normalizedStep))
  );
}

function WorkflowPills({ result }: { result: ClxParseResult }) {
  const steps = splitWorkflow(result.workHints?.flow ?? []);
  if (steps.length === 0) return null;

  const names = currentScreenNames(result);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => {
        const isCurrent = isCurrentWorkflowStep(step, names);
        return (
          <span key={`${step}-${index}`} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                isCurrent
                  ? "border-blue-500 bg-blue-100 text-blue-700 shadow-[0_0_0_2px_rgba(37,99,235,0.08)]"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              {step}
              {isCurrent && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  현재
                </span>
              )}
            </span>
            {index < steps.length - 1 && (
              <span className="text-xs font-bold text-muted-foreground">→</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── 분석결과 아코디언 ─────────────────────────────────────────
interface ParseResultAccordionProps {
  result: ClxParseResult;
  nav?: ScreenNav;
}

export function ParseResultAccordion({ result, nav }: ParseResultAccordionProps) {
  const { overview, workHints, usage, notes, items, tabPages, popups, usedUdcs } = result;
  const allExtButtons = [
    ...usage.menuTitleBar.extButtons,
    ...usage.titleBars.flatMap((tb) => tb.extButtons),
    ...usage.extraButtons,
  ];
  const hasWorkHints = !!workHints && (
    workHints.flow.length > 0 ||
    workHints.required.length > 0 ||
    workHints.caution.length > 0
  );

  // 자식 화면(탭/팝업) URI → 결과 인덱스 해석 후 이동 버튼/요약 렌더
  const renderNavCell = (uri: string) => {
    const idx = nav?.resolveIndexByUri(uri);
    if (idx === undefined) {
      return <span className="text-muted-foreground text-xs">미생성</span>;
    }
    return (
      <button
        type="button"
        onClick={() => nav!.onNavigate(idx)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        이동 <CornerDownRight className="h-3 w-3" aria-hidden="true" />
      </button>
    );
  };

  const childSummary = (uri: string) => {
    const idx = nav?.resolveIndexByUri(uri);
    if (idx === undefined || !nav) return null;
    const ov = nav.results[idx]?.parseResult.overview;
    if (!ov) return null;
    return (
      <span className="text-xs text-muted-foreground">
        {ov.programName || nav.results[idx].fileName}
        {ov.description ? ` — ${ov.description}` : ""}
      </span>
    );
  };

  return (
    <div className="space-y-2" aria-label="CLX 파싱 결과">
      {/* 메인 화면으로 돌아가기 (현재가 탭/팝업일 때) */}
      {nav?.parentIndex !== undefined && (
        <button
          type="button"
          onClick={() => nav.onNavigate(nav.parentIndex!)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          메인 화면으로 돌아가기{nav.parentLabel ? ` (${nav.parentLabel})` : ""}
        </button>
      )}
      {/* 화면개요 */}
      <Section id="overview" icon={<LayoutDashboard className="h-4 w-4" />} title="화면개요" defaultOpen>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {([
            ["시스템명", overview.systemName],
            ["부시스템", overview.subSystem],
            ["프로그램", overview.programName],
            ["설명", overview.description],
            overview.author ? ["작성자", overview.author] : null,
            overview.createDate ? ["작성일자", overview.createDate] : null,
          ].filter((item): item is string[] => item !== null)
          ).map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-muted-foreground shrink-0 w-20">{label}</span>
              <span className="font-medium whitespace-pre-line">{value || "-"}</span>
            </div>
          ))}
          {workHints?.flow.length ? (
            <div className="flex gap-2 sm:col-span-2">
              <span className="text-muted-foreground shrink-0 w-20">업무흐름</span>
              <WorkflowPills result={result} />
            </div>
          ) : null}
        </div>
      </Section>

      {/* 작성자 업무 힌트 */}
      {hasWorkHints && (
        <Section
          id="work-hints"
          icon={<ClipboardList className="h-4 w-4" />}
          title="작성자 업무 힌트"
          badge={(workHints.flow.length + workHints.required.length + workHints.caution.length)}
          defaultOpen
        >
          <div className="space-y-3 text-sm">
            {workHints.flow.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">업무흐름</p>
                <WorkflowPills result={result} />
              </div>
            )}
            {workHints.required.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">필수사항</p>
                <ul className="list-disc pl-5 space-y-1">
                  {workHints.required.map((item, index) => (
                    <li key={`required-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {workHints.caution.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">주의사항</p>
                <ul className="list-disc pl-5 space-y-1">
                  {workHints.caution.map((item, index) => (
                    <li key={`caution-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 사용방법 (CRUD) */}
      <Section id="usage" icon={<Database className="h-4 w-4" />} title="사용방법 (CRUD)">
        <div className="space-y-3">
          {/* MenuTitleBar */}
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground font-medium">메뉴 타이틀바</p>
            <div className="flex flex-wrap gap-1.5">
              {usage.menuTitleBar.hasInquiry && <Badge variant="secondary">조회</Badge>}
              {usage.menuTitleBar.hasNew && <Badge variant="secondary">신규</Badge>}
              {usage.menuTitleBar.hasSave && <Badge variant="secondary">저장</Badge>}
              {usage.menuTitleBar.hasDelete && <Badge variant="secondary">삭제</Badge>}
              {!usage.menuTitleBar.hasInquiry && !usage.menuTitleBar.hasNew && !usage.menuTitleBar.hasSave && !usage.menuTitleBar.hasDelete && (
                <span className="text-muted-foreground">CRUD 없음</span>
              )}
            </div>
          </div>
          {/* TitleBars */}
          {usage.titleBars.map((tb, i) => (
            <div key={i} className="text-xs space-y-1">
              <p className="text-muted-foreground font-medium">{tb.title || `타이틀바 ${i + 1}`}</p>
              <div className="flex flex-wrap gap-1.5">
                {tb.hasInquiry && <Badge variant="secondary">조회</Badge>}
                {tb.hasNew && <Badge variant="secondary">신규</Badge>}
                {tb.hasSave && <Badge variant="secondary">저장</Badge>}
                {tb.hasDelete && <Badge variant="secondary">삭제</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 추가 버튼 */}
      {allExtButtons.length > 0 && (
        <Section id="buttons" icon={<MousePointer2 className="h-4 w-4" />} title="추가 버튼" badge={allExtButtons.length}>
          <SimpleTable
            headers={["버튼명", "함수명", "설명"]}
            rows={allExtButtons.map((btn) => [
              btn.name,
              <code key="fn" className="font-mono text-xs">{btn.functionName}</code>,
              btn.description ? <span className="whitespace-pre-line">{btn.description}</span> : "-",
            ])}
          />
        </Section>
      )}

      {/* 필수값/검증 */}
      <Section
        id="validations"
        icon={<ShieldCheck className="h-4 w-4" />}
        title="필수값/검증"
        badge={notes.requiredFields.length + notes.validations.length}
      >
        {notes.requiredFields.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">필수값</p>
            <SimpleTable
              headers={["대상", "컬럼", "항목명"]}
              rows={notes.requiredFields.map((rf) => [
                <code key="tid" className="font-mono text-xs">{rf.targetId}</code>,
                rf.columns.join(", "),
                rf.texts.join(", "),
              ])}
            />
          </div>
        )}
        {notes.validations.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">검증 메시지</p>
            <SimpleTable
              headers={["함수명", "메시지"]}
              rows={notes.validations.map((v) => [
                <code key="fn" className="font-mono text-xs">{v.functionName}</code>,
                v.message,
              ])}
            />
          </div>
        )}
        {notes.requiredFields.length === 0 && notes.validations.length === 0 && (
          <p className="text-sm text-muted-foreground">필수값/검증 없음</p>
        )}
      </Section>

      {/* 그리드 */}
      <Section id="grids" icon={<Grid3X3 className="h-4 w-4" />} title="그리드" badge={items.grids.length}>
        {items.grids.map((grid) => (
          <div key={grid.gridId} className="space-y-2 mb-4 last:mb-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{grid.title || grid.gridId}</span>
              <Badge variant="secondary" className="text-xs">{grid.columns.length}컬럼</Badge>
              {grid.hasCheckbox && <Badge variant="outline" className="text-xs">체크박스</Badge>}
              {grid.sortable && <Badge variant="outline" className="text-xs">정렬</Badge>}
            </div>
            <SimpleTable
              headers={["컬럼명", "헤더", "컨트롤", "용도"]}
              rows={grid.columns.map((col) => [
                <code key="cn" className="font-mono text-xs">{col.columnName}</code>,
                col.headerText,
                col.controlType,
                col.purpose,
              ])}
            />
          </div>
        ))}
        {items.grids.length === 0 && <p className="text-sm text-muted-foreground">그리드 없음</p>}
      </Section>

      {/* 조건그룹 */}
      <Section id="conditions" icon={<Filter className="h-4 w-4" />} title="조건그룹" badge={items.conditionGroups.length}>
        {items.conditionGroups.map((grp) => (
          <div key={grp.groupId} className="mb-3 last:mb-0">
            <p className="text-xs text-muted-foreground mb-1.5">
              {grp.title || grp.groupId} <Badge variant="outline" className="text-xs ml-1">{grp.groupType}</Badge>
            </p>
            <SimpleTable
              headers={["컨트롤ID", "항목명", "타입", "입력구분"]}
              rows={grp.controls.map((c) => [
                <code key="cid" className="font-mono text-xs">{c.controlId}</code>,
                c.labelText,
                c.controlType,
                c.inputType,
              ])}
            />
          </div>
        ))}
        {items.conditionGroups.length === 0 && <p className="text-sm text-muted-foreground">조건그룹 없음</p>}
      </Section>

      {/* 인포그룹 */}
      <Section id="info" icon={<Info className="h-4 w-4" />} title="인포그룹" badge={items.infoGroups.length}>
        {items.infoGroups.map((grp) => (
          <div key={grp.groupId} className="mb-3 last:mb-0">
            <p className="text-xs text-muted-foreground mb-1.5">{grp.title || grp.groupId}</p>
            <SimpleTable
              headers={["컨트롤ID", "항목명", "타입", "입력구분"]}
              rows={grp.controls.map((c) => [
                <code key="cid" className="font-mono text-xs">{c.controlId}</code>,
                c.labelText,
                c.controlType,
                c.inputType,
              ])}
            />
          </div>
        ))}
        {items.infoGroups.length === 0 && <p className="text-sm text-muted-foreground">인포그룹 없음</p>}
      </Section>

      {/* 팝업 */}
      <Section id="popups" icon={<Layers className="h-4 w-4" />} title="팝업" badge={popups.length}>
        <SimpleTable
          headers={["팝업 ID", "URL", "콜백", "크기", "화면", "이동"]}
          rows={popups.map((p) => [
            <code key="pid" className="font-mono text-xs">{p.popupId}</code>,
            <code key="url" className="font-mono text-xs">{p.popupUrl}</code>,
            <code key="cb" className="font-mono text-xs">{p.callbackFunction}</code>,
            `${p.width}×${p.height}`,
            childSummary(p.popupUrl) ?? "-",
            renderNavCell(p.popupUrl),
          ])}
        />
        {popups.length === 0 && <p className="text-sm text-muted-foreground">팝업 없음</p>}
      </Section>

      {/* 탭페이지 */}
      <Section id="tabs" icon={<Layers className="h-4 w-4" />} title="탭페이지" badge={tabPages.length}>
        {tabPages.length === 0 ? (
          <p className="text-sm text-muted-foreground">탭 없음</p>
        ) : (
          <SimpleTable
            headers={["앱 URI", "탭명", "호출위치", "화면", "이동"]}
            rows={tabPages.map((tp) => [
              <code key="uri" className="font-mono text-xs">{tp.appUri}</code>,
              tp.tabLabel || "-",
              tp.calledFrom,
              childSummary(tp.appUri) ?? "-",
              renderNavCell(tp.appUri),
            ])}
          />
        )}
      </Section>

      {/* 사용 UDC */}
      <Section id="udcs" icon={<Package className="h-4 w-4" />} title="사용 UDC" badge={usedUdcs.length}>
        {usedUdcs.length === 0 ? (
          <p className="text-sm text-muted-foreground">UDC 없음</p>
        ) : (
          <SimpleTable
            headers={["UDC명", "전체 경로", "설명"]}
            rows={usedUdcs.map((u) => [
              <code key="sn" className="font-mono text-xs">{u.shortName}</code>,
              <code key="qn" className="font-mono text-xs">{u.qualifiedName}</code>,
              u.description || "-",
            ])}
          />
        )}
      </Section>
    </div>
  );
}
