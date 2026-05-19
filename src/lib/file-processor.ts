import type { FileNode, UploadedFile } from "@/types";

/** 파일 내용을 텍스트로 읽기 */
function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`파일 읽기 실패: ${file.name}`));
    reader.readAsText(file, "utf-8");
  });
}

/** .clx.js 파일인지 확인 */
export function isClxFile(name: string): boolean {
  return name.endsWith(".clx.js");
}

/** DataTransferItem에서 재귀적으로 파일 수집 (폴더 드롭 지원) */
export async function collectFilesFromDrop(
  dataTransfer: DataTransfer
): Promise<File[]> {
  const items = Array.from(dataTransfer.items);
  const files: File[] = [];

  // webkitGetAsEntry 지원 여부 확인
  const hasEntryApi = items.some(
    (item) => "webkitGetAsEntry" in item || "getAsEntry" in item
  );

  if (hasEntryApi) {
    const entries = items
      .map((item) => {
        const entry =
          (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ??
          (item as DataTransferItem & { getAsEntry?: () => FileSystemEntry | null }).getAsEntry?.();
        return entry;
      })
      .filter((e): e is FileSystemEntry => e !== null);

    for (const entry of entries) {
      const entryFiles = await readEntry(entry);
      files.push(...entryFiles);
    }
  } else {
    // fallback: 일반 파일 목록만 사용
    files.push(...Array.from(dataTransfer.files));
  }

  return files.filter((f) => isClxFile(f.name));
}

/** FileSystemEntry 재귀 읽기 */
function readEntry(entry: FileSystemEntry): Promise<File[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => resolve([file]),
        () => resolve([])
      );
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const allFiles: File[] = [];

      // readEntries는 한 번에 최대 100개만 반환할 수 있음 → 반복 호출
      const readBatch = () => {
        dirReader.readEntries(
          async (entries) => {
            if (entries.length === 0) {
              resolve(allFiles);
              return;
            }
            for (const subEntry of entries) {
              const subFiles = await readEntry(subEntry);
              allFiles.push(...subFiles);
            }
            readBatch(); // 다음 배치
          },
          () => resolve(allFiles)
        );
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

/** File 배열 → FileNode 트리 + UploadedFile 배열 (파일 content 읽기 포함) */
export async function processUploadedFiles(
  files: File[],
  existingPaths: Set<string>
): Promise<{ nodes: FileNode[]; uploaded: UploadedFile[] }> {
  const uploaded: UploadedFile[] = [];
  const folderMap = new Map<string, FileNode>();
  const roots: FileNode[] = [];

  // 중복 제거
  const uniqueFiles = files.filter((file) => {
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    return !existingPaths.has(relativePath);
  });

  // 파일 내용 병렬 읽기
  const contents = await Promise.all(
    uniqueFiles.map((file) => readFileContent(file))
  );

  uniqueFiles.forEach((file, i) => {
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const parts = relativePath.split("/");
    const fileId = `file-${Date.now()}-${i}`;

    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      path: relativePath,
      size: file.size,
      content: contents[i],
      lastModified: file.lastModified,
    };
    uploaded.push(uploadedFile);

    const fileNode: FileNode = {
      id: fileId,
      name: file.name,
      type: "file",
      path: relativePath,
      checkState: "checked",
      file,
      extension: "clx.js",
      size: file.size,
    };

    if (parts.length === 1) {
      roots.push(fileNode);
    } else {
      let currentPath = "";
      let parentChildren: FileNode[] = roots;

      for (let d = 0; d < parts.length - 1; d++) {
        currentPath = currentPath ? `${currentPath}/${parts[d]}` : parts[d];
        if (!folderMap.has(currentPath)) {
          const folderNode: FileNode = {
            id: `folder-${currentPath}`,
            name: parts[d],
            type: "folder",
            path: currentPath,
            checkState: "checked",
            children: [],
          };
          folderMap.set(currentPath, folderNode);
          parentChildren.push(folderNode);
        }
        parentChildren = folderMap.get(currentPath)!.children!;
      }

      parentChildren.push(fileNode);
    }
  });

  return { nodes: roots, uploaded };
}

/** 트리에서 모든 파일 경로 수집 */
export function collectAllPaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (node.type === "file") {
      paths.add(node.path);
    }
    if (node.children) {
      for (const p of collectAllPaths(node.children)) {
        paths.add(p);
      }
    }
  }
  return paths;
}
