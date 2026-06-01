"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  UdcComponent,
  UdcControl,
  UdcProperty,
  UdcFunction,
  UdcDataset,
  UdcComponentType,
} from "@/types";
import { UDC_TYPE_LABELS, UDC_TYPE_COLORS } from "./constants";

interface UdcFullDetail {
  component: UdcComponent;
  controls: UdcControl[];
  properties: UdcProperty[];
  functions: UdcFunction[];
  datasets: UdcDataset[];
}

interface UdcDetailSheetProps {
  shortName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UdcDetailSheet({ shortName, open, onOpenChange }: UdcDetailSheetProps) {
  const [detail, setDetail] = useState<UdcFullDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shortName) return;
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/udc/${encodeURIComponent(shortName)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "상세 조회 실패");
        }
        return res.json();
      })
      .then((data: UdcFullDetail) => {
        if (active) setDetail(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, shortName]);

  const comp = detail?.component;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
              {shortName}
            </code>
            {comp && (
              <span
                className={cn(
                  "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                  UDC_TYPE_COLORS[comp.component_type as UdcComponentType]
                )}
              >
                {UDC_TYPE_LABELS[comp.component_type as UdcComponentType]}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>{comp?.display_name ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              불러오는 중…
            </div>
          )}
          {error && (
            <div className="py-8 text-center text-sm text-destructive">{error}</div>
          )}

          {detail && comp && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                <Meta label="전체명" value={comp.qualified_name} mono />
                <Meta label="카테고리" value={comp.category} />
                <Meta label="작성자" value={comp.author ?? "—"} />
                <Meta label="버전" value={comp.version ?? "—"} />
                <Meta
                  label="사용 섹션"
                  value={comp.section_usage.length ? comp.section_usage.join(", ") : "—"}
                />
              </dl>
              {comp.description && (
                <p className="text-sm text-muted-foreground mb-4">{comp.description}</p>
              )}

              <Tabs defaultValue="controls">
                <TabsList>
                  <TabsTrigger value="controls">컨트롤 ({detail.controls.length})</TabsTrigger>
                  <TabsTrigger value="properties">
                    프로퍼티 ({detail.properties.length})
                  </TabsTrigger>
                  <TabsTrigger value="functions">함수 ({detail.functions.length})</TabsTrigger>
                  <TabsTrigger value="datasets">데이터셋 ({detail.datasets.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="controls">
                  <ControlsTable controls={detail.controls} />
                </TabsContent>
                <TabsContent value="properties">
                  <PropertiesTable properties={detail.properties} />
                </TabsContent>
                <TabsContent value="functions">
                  <FunctionsTable functions={detail.functions} />
                </TabsContent>
                <TabsContent value="datasets">
                  <DatasetsTable datasets={detail.datasets} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", mono && "font-mono text-xs break-all")}>{value}</dd>
    </div>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">데이터 없음</p>;
  }
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1.5 align-top">
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

const Code = ({ children }: { children: React.ReactNode }) =>
  children ? (
    <code className="font-mono bg-muted px-1 py-0.5 rounded">{children}</code>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

function ControlsTable({ controls }: { controls: UdcControl[] }) {
  return (
    <MiniTable
      headers={["컨트롤 ID", "유형", "기본 라벨", "라벨여부", "쌍"]}
      rows={controls.map((c) => [
        <Code key="id">{c.control_id}</Code>,
        c.control_type,
        c.default_label ?? "—",
        c.is_label_control ? "✓" : "",
        <Code key="p">{c.paired_control_id}</Code>,
      ])}
    />
  );
}

function PropertiesTable({ properties }: { properties: UdcProperty[] }) {
  return (
    <MiniTable
      headers={["프로퍼티", "그룹", "기본값", "대상 컨트롤"]}
      rows={properties.map((p) => [
        <Code key="n">{p.property_name}</Code>,
        p.property_group,
        p.default_value ?? "—",
        <Code key="t">{p.target_control_id}</Code>,
      ])}
    />
  );
}

function FunctionsTable({ functions }: { functions: UdcFunction[] }) {
  return (
    <MiniTable
      headers={["함수명", "유형", "설명", "영향 프로퍼티"]}
      rows={functions.map((f) => [
        <Code key="n">{f.function_name}</Code>,
        f.function_type,
        f.description ?? "—",
        f.target_properties.length ? f.target_properties.join(", ") : "—",
      ])}
    />
  );
}

function DatasetsTable({ datasets }: { datasets: UdcDataset[] }) {
  return (
    <MiniTable
      headers={["데이터셋", "바인딩 컨트롤", "코드 컬럼", "명칭 컬럼"]}
      rows={datasets.map((d) => [
        <Code key="n">{d.dataset_name}</Code>,
        <Code key="b">{d.bound_control_id}</Code>,
        d.code_column ?? "—",
        d.name_column ?? "—",
      ])}
    />
  );
}
