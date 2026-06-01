import { supabase } from "@/lib/supabase/client";

const BUCKET = "screen-images";

/** screen_image 테이블 레코드 */
export interface ScreenImage {
  file_base: string;
  storage_path: string;
  content_type: string;
  original_name: string;
  uploaded_at: string;
}

/** 레코드 + 공개 URL */
export interface ScreenImageWithUrl extends ScreenImage {
  publicUrl: string;
}

function publicUrlOf(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** 화면 이미지 전체 목록 (공개 URL 포함) */
export async function listScreenImages(): Promise<ScreenImageWithUrl[]> {
  const { data, error } = await supabase
    .from("screen_image")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`화면 이미지 조회 실패: ${error.message}`);

  return (data ?? []).map((row) => ({
    ...(row as ScreenImage),
    publicUrl: publicUrlOf((row as ScreenImage).storage_path),
  }));
}

/** file_base → 공개 URL 매핑 (결과 페이지 자동 적용용) */
export async function getScreenImageUrlMap(): Promise<Record<string, string>> {
  const list = await listScreenImages();
  const map: Record<string, string> = {};
  for (const img of list) map[img.file_base] = img.publicUrl;
  return map;
}

/** 화면 이미지 업로드(또는 교체) — 파일당 1장, file_base 기준 upsert */
export async function upsertScreenImage(
  fileBase: string,
  file: File
): Promise<ScreenImageWithUrl> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const storagePath = `${fileBase}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: file.type || "image/png" });

  if (uploadError) throw new Error(`이미지 업로드 실패: ${uploadError.message}`);

  const record: ScreenImage = {
    file_base: fileBase,
    storage_path: storagePath,
    content_type: file.type || "image/png",
    original_name: file.name,
    uploaded_at: new Date().toISOString(),
  };

  const { error: dbError } = await supabase
    .from("screen_image")
    .upsert(record, { onConflict: "file_base" });

  if (dbError) throw new Error(`이미지 정보 저장 실패: ${dbError.message}`);

  return { ...record, publicUrl: publicUrlOf(storagePath) };
}

/** 화면 이미지 삭제 (Storage 객체 + 레코드) */
export async function deleteScreenImage(fileBase: string): Promise<void> {
  const { data: row, error: findError } = await supabase
    .from("screen_image")
    .select("storage_path")
    .eq("file_base", fileBase)
    .maybeSingle();

  if (findError) throw new Error(`화면 이미지 조회 실패: ${findError.message}`);

  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }

  const { error: deleteError } = await supabase
    .from("screen_image")
    .delete()
    .eq("file_base", fileBase);

  if (deleteError) throw new Error(`화면 이미지 삭제 실패: ${deleteError.message}`);
}
