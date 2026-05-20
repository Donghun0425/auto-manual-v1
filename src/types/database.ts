/**
 * Supabase 데이터베이스 스키마 타입 정의
 */

/** 단어사전 테이블 — PK: (term, context_type) */
export interface Dictionary {
  term: string;
  context_type: DictionaryContextType;
  category: DictionaryCategory;
  description: string;
  source: DictionarySource;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 단어사전 등록 입력 */
export interface DictionaryInsert {
  term: string;
  context_type: DictionaryContextType;
  category: DictionaryCategory;
  description: string;
  source?: DictionarySource;
  user_id?: string | null;
}

/** 단어사전 수정 입력 (PK 필드 term·context_type 제외) */
export interface DictionaryUpdate {
  category?: DictionaryCategory;
  description?: string;
  source?: DictionarySource;
  updated_at?: string;
}

/** 단어사전 카테고리 */
export type DictionaryCategory =
  | "공통"
  | "학사"
  | "행정"
  | "연구"
  | "부속"
  | "기타";

/** 단어사전 등록 출처 */
export type DictionarySource = "manual" | "ai";
/** 단어사전 항목 유형 (조회조건 | 그리드 | 처리조건 | 인포영역) */
export type DictionaryContextType = "조회조건" | "그리드" | "처리조건" | "인포영역";
/** 레이아웃 템플릿 테이블 */
export interface LayoutTemplate {
  id: string;
  name: string;
  sections: LayoutSection[];
  user_id: string | null;
  is_default: boolean;
  created_at: string;
}

/** 레이아웃 템플릿 등록 입력 */
export interface LayoutTemplateInsert {
  name: string;
  sections: LayoutSection[];
  user_id?: string | null;
  is_default?: boolean;
}

/** 레이아웃 템플릿 수정 입력 */
export interface LayoutTemplateUpdate {
  name?: string;
  sections?: LayoutSection[];
  is_default?: boolean;
}

/** 레이아웃 섹션 정의 */
export interface LayoutSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  options?: LayoutSectionOptions;
}

/** 섹션별 세부 옵션 */
export interface LayoutSectionOptions {
  showTable?: boolean;
  descriptionDepth?: "brief" | "detailed";
  showExamples?: boolean;
  customTitle?: string;
}

/** 생성 로그 테이블 */
export interface GenerationLog {
  id: string;
  file_name: string;
  output_type: OutputType;
  token_usage: number;
  user_id: string | null;
  created_at: string;
}

/** 생성 로그 등록 입력 */
export interface GenerationLogInsert {
  file_name: string;
  output_type: OutputType;
  token_usage: number;
  user_id?: string | null;
}

/** 출력 형식 */
export type OutputType = "html" | "md";

/** Supabase Database 전체 스키마 */
export interface Database {
  public: {
    Tables: {
      dictionary: {
        Row: Dictionary;
        Insert: DictionaryInsert;
        Update: DictionaryUpdate;
        Relationships: [];
      };
      layout_template: {
        Row: LayoutTemplate;
        Insert: LayoutTemplateInsert;
        Update: LayoutTemplateUpdate;
        Relationships: [];
      };
      generation_log: {
        Row: GenerationLog;
        Insert: GenerationLogInsert;
        Update: Partial<GenerationLogInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
