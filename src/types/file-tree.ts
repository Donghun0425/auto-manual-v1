/**
 * 파일 트리 구조 타입 정의
 */

/** 파일 노드 체크 상태 */
export type CheckState = "checked" | "unchecked" | "indeterminate";

/** 파일 노드 타입 */
export type FileNodeType = "file" | "folder";

/** 파일 트리 노드 */
export interface FileNode {
  id: string;
  name: string;
  type: FileNodeType;
  path: string;
  checkState: CheckState;
  children?: FileNode[];
  /** 원본 File 객체 (파일 노드에만 존재) */
  file?: File;
  /** 파일 확장자 */
  extension?: string;
  /** 파일 크기 (bytes) */
  size?: number;
}

/** 파일 트리 전체 구조 */
export interface FileTree {
  root: FileNode[];
  totalFiles: number;
  selectedFiles: number;
}

/** 업로드된 파일 정보 */
export interface UploadedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  content: string;
  lastModified: number;
}

/** 파일 업로드 모드 */
export type UploadMode = "single" | "multiple" | "folder";
