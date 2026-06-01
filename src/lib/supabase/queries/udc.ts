import { supabase } from "@/lib/supabase/client";
import type {
  UdcComponent,
  UdcComponentType,
  UdcCategory,
  UdcControl,
  UdcProperty,
  UdcFunction,
  UdcDataset,
  UdcParseResult,
  ParsedUdc,
  UdcControlInsert,
  UdcPropertyInsert,
  UdcFunctionInsert,
  UdcDatasetInsert,
} from "@/types";
import type { UdcDetail } from "@/lib/parser/udc-label-resolver";

// ============================================================
// 조회
// ============================================================

export interface UdcListParams {
  search?: string;
  componentType?: UdcComponentType | "all";
  category?: UdcCategory | "all";
  page?: number;
  pageSize?: number;
}

export interface UdcListResult {
  data: UdcComponent[];
  total: number;
}

/** UDC 목록 조회 (검색·필터·페이지네이션) */
export async function listUdcs({
  search = "",
  componentType = "all",
  category = "all",
  page = 1,
  pageSize = 20,
}: UdcListParams = {}): Promise<UdcListResult> {
  let query = supabase
    .from("udc_component")
    .select("*", { count: "exact" })
    .order("short_name", { ascending: true });

  if (search.trim()) {
    const s = search.trim();
    query = query.or(
      `short_name.ilike.%${s}%,display_name.ilike.%${s}%,description.ilike.%${s}%`
    );
  }
  if (componentType && componentType !== "all") {
    query = query.eq("component_type", componentType);
  }
  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`UDC 목록 조회 실패: ${error.message}`);
  return { data: (data ?? []) as UdcComponent[], total: count ?? 0 };
}

/** 단축명 일괄 조회 — 매뉴얼 생성 시 사용 (사전에 없는 항목은 제외) */
export async function findUdcsByShortNames(
  shortNames: string[]
): Promise<Map<string, UdcComponent>> {
  if (shortNames.length === 0) return new Map();
  const { data, error } = await supabase
    .from("udc_component")
    .select("*")
    .in("short_name", shortNames);

  if (error) throw new Error(`UDC 일괄 조회 실패: ${error.message}`);

  const map = new Map<string, UdcComponent>();
  for (const row of (data ?? []) as UdcComponent[]) {
    map.set(row.short_name, row);
  }
  return map;
}

/** 단축명으로 UDC 상세(컴포넌트 + 하위 엔티티) 일괄 조회 */
export async function getUdcDetailsByShortNames(
  shortNames: string[]
): Promise<Map<string, UdcDetail>> {
  const components = await findUdcsByShortNames(shortNames);
  if (components.size === 0) return new Map();

  const ids = [...components.values()].map((c) => c.id);
  const [controls, properties, functions] = await Promise.all([
    fetchChildren<UdcControl>("udc_control", ids),
    fetchChildren<UdcProperty>("udc_property", ids),
    fetchChildren<UdcFunction>("udc_function", ids),
  ]);

  const byId = new Map<string, UdcDetail>();
  for (const comp of components.values()) {
    byId.set(comp.short_name, {
      component: comp,
      controls: controls.filter((c) => c.udc_id === comp.id),
      properties: properties.filter((p) => p.udc_id === comp.id),
      functions: functions.filter((f) => f.udc_id === comp.id),
    });
  }
  return byId;
}

async function fetchChildren<T>(
  table: "udc_control" | "udc_property" | "udc_function" | "udc_dataset",
  udcIds: string[]
): Promise<(T & { udc_id: string })[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .in("udc_id", udcIds);
  if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
  return (data ?? []) as (T & { udc_id: string })[];
}

export interface UdcFullDetail {
  component: UdcComponent;
  controls: UdcControl[];
  properties: UdcProperty[];
  functions: UdcFunction[];
  datasets: UdcDataset[];
}

/** 단건 UDC 전체 상세 조회 (UI 상세 화면용) */
export async function getUdcDetail(shortName: string): Promise<UdcFullDetail | null> {
  const { data: comp, error } = await supabase
    .from("udc_component")
    .select("*")
    .eq("short_name", shortName)
    .maybeSingle();

  if (error) throw new Error(`UDC 조회 실패: ${error.message}`);
  if (!comp) return null;

  const component = comp as UdcComponent;
  const [controls, properties, functions, datasets] = await Promise.all([
    fetchChildren<UdcControl>("udc_control", [component.id]),
    fetchChildren<UdcProperty>("udc_property", [component.id]),
    fetchChildren<UdcFunction>("udc_function", [component.id]),
    fetchChildren<UdcDataset>("udc_dataset", [component.id]),
  ]);

  return { component, controls, properties, functions, datasets };
}

/** 전문 검색 (이름·설명 부분일치) */
export async function searchUdcs(keyword: string, limit = 20): Promise<UdcComponent[]> {
  const k = keyword.trim();
  if (!k) return [];
  const { data, error } = await supabase
    .from("udc_component")
    .select("*")
    .or(`short_name.ilike.%${k}%,display_name.ilike.%${k}%,description.ilike.%${k}%`)
    .limit(limit);
  if (error) throw new Error(`UDC 검색 실패: ${error.message}`);
  return (data ?? []) as UdcComponent[];
}

// ============================================================
// 업서트 (udc.js 업로드)
// ============================================================

export interface UpsertSummary {
  componentCount: number;
  upsertedCount: number;
  unchangedCount: number;
}

/**
 * 파싱 결과를 DB 에 반영한다 (source_hash 기반 증분 업서트).
 *  - 동일 source_hash 면 스킵(unchanged)
 *  - 변경/신규면 컴포넌트 upsert 후 하위 엔티티 전량 교체
 *  - 업로드 이력 기록
 */
export async function upsertUdcComponents(
  parsed: UdcParseResult
): Promise<UpsertSummary> {
  const existing = await findUdcsByShortNames(
    parsed.udcs.map((u) => u.component.short_name)
  );

  let upserted = 0;
  let unchanged = 0;

  for (const udc of parsed.udcs) {
    const prev = existing.get(udc.component.short_name);
    if (prev && prev.source_hash === udc.component.source_hash) {
      unchanged++;
      continue;
    }
    await upsertSingleUdc(udc);
    upserted++;
  }

  await supabase.from("udc_upload_log").insert({
    file_name: parsed.fileName,
    file_hash: parsed.fileHash,
    component_count: parsed.udcs.length,
    upserted_count: upserted,
    unchanged_count: unchanged,
  } as unknown as Record<string, unknown>);

  return {
    componentCount: parsed.udcs.length,
    upsertedCount: upserted,
    unchangedCount: unchanged,
  };
}

/** 단일 UDC upsert: 컴포넌트 upsert → 하위 엔티티 삭제 후 재삽입 */
async function upsertSingleUdc(udc: ParsedUdc): Promise<void> {
  const { data: comp, error } = await supabase
    .from("udc_component")
    .upsert(udc.component as unknown as Record<string, unknown>, { onConflict: "short_name" })
    .select()
    .single();

  if (error) throw new Error(`UDC 컴포넌트 등록 실패: ${error.message}`);
  const udcId = (comp as UdcComponent).id;

  // 하위 엔티티 전량 교체 (CASCADE 가 아닌 명시적 삭제 — 컴포넌트는 유지)
  await Promise.all([
    supabase.from("udc_control").delete().eq("udc_id", udcId),
    supabase.from("udc_property").delete().eq("udc_id", udcId),
    supabase.from("udc_function").delete().eq("udc_id", udcId),
    supabase.from("udc_dataset").delete().eq("udc_id", udcId),
  ]);

  const controls: UdcControlInsert[] = udc.controls.map((c) => ({ ...c, udc_id: udcId }));
  const properties: UdcPropertyInsert[] = udc.properties.map((p) => ({ ...p, udc_id: udcId }));
  const functions: UdcFunctionInsert[] = udc.functions.map((f) => ({ ...f, udc_id: udcId }));
  const datasets: UdcDatasetInsert[] = udc.datasets.map((d) => ({ ...d, udc_id: udcId }));

  const inserts: Promise<unknown>[] = [];
  if (controls.length)
    inserts.push(
      Promise.resolve(supabase.from("udc_control").insert(controls as unknown as Record<string, unknown>[]))
    );
  if (properties.length)
    inserts.push(
      Promise.resolve(supabase.from("udc_property").insert(properties as unknown as Record<string, unknown>[]))
    );
  if (functions.length)
    inserts.push(
      Promise.resolve(supabase.from("udc_function").insert(functions as unknown as Record<string, unknown>[]))
    );
  if (datasets.length)
    inserts.push(
      Promise.resolve(supabase.from("udc_dataset").insert(datasets as unknown as Record<string, unknown>[]))
    );

  await Promise.all(inserts);
}

/** 전체 UDC 삭제 (재업로드 초기화용) */
export async function clearAllUdcs(): Promise<void> {
  const { error } = await supabase
    .from("udc_component")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`UDC 전체 삭제 실패: ${error.message}`);
}
