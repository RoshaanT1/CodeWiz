// Filters a GitHub tree listing and groups files by folder.
// Pure and portable: no imports from the app, Next.js, React or Supabase.

/** One entry of GitHub's `git/trees` response (only the fields we use). */
export type TreeEntry = {
  path: string;
  type: string;
  mode?: string;
  size?: number;
};

export type FolderGroup = {
  /** Folder path, or "" for files at the repo root. */
  folder: string;
  /** File names (not full paths) inside that folder. */
  files: string[];
};

/** Shape returned by the preview route on success. */
export type RepoPreviewData = {
  owner: string;
  repo: string;
  defaultBranch: string;
  /** Branch named in the URL, if any. We still list the default branch. */
  requestedBranch: string | null;
  /** True when GitHub says the tree was cut short. */
  truncated: boolean;
  /** Number of files kept after filtering. */
  fileCount: number;
  /** Full paths of the kept files, sorted. */
  files: string[];
};

/** Folders we never list, at any depth. */
export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "vendor",
]);

/** Extensions treated as binary (not useful to read as source). */
export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  // images
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "icns", "tif", "tiff",
  "psd", "ai", "heic", "avif",
  // audio and video
  "mp3", "wav", "ogg", "flac", "aac", "m4a", "mp4", "mov", "avi", "mkv",
  "webm", "wmv",
  // fonts
  "woff", "woff2", "ttf", "otf", "eot",
  // archives and packages
  "zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar", "war", "whl",
  "egg", "nupkg",
  // compiled and native
  "exe", "dll", "so", "dylib", "a", "o", "obj", "lib", "class", "pyc",
  "pyo", "wasm", "bin", "dat", "node",
  // documents and data blobs
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "sqlite", "db",
  "parquet", "pkl", "npy", "onnx", "pt", "h5",
]);

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

export function isBinaryPath(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return BINARY_EXTENSIONS.has(extensionOf(name));
}

/** True when any folder segment of the path is in `SKIPPED_FOLDERS`. */
export function isInSkippedFolder(path: string): boolean {
  const segments = path.split("/");
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (SKIPPED_FOLDERS.has(segments[i])) return true;
  }
  return false;
}

/**
 * Keeps regular files only (no folders, submodules or symlinks), drops files
 * under skipped folders and binary files, and returns sorted paths.
 */
export function filterTree(entries: readonly TreeEntry[]): string[] {
  const kept: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "blob") continue;
    if (entry.mode === "120000") continue; // symlink
    if (isInSkippedFolder(entry.path)) continue;
    if (isBinaryPath(entry.path)) continue;
    kept.push(entry.path);
  }
  return kept.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Groups full file paths by their folder. Root files come first. */
export function groupByFolder(paths: readonly string[]): FolderGroup[] {
  const byFolder = new Map<string, string[]>();
  for (const path of paths) {
    const slash = path.lastIndexOf("/");
    const folder = slash === -1 ? "" : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const list = byFolder.get(folder);
    if (list) list.push(name);
    else byFolder.set(folder, [name]);
  }
  return [...byFolder.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a === "") return -1;
      if (b === "") return 1;
      return a < b ? -1 : 1;
    })
    .map(([folder, files]) => ({ folder, files: files.sort() }));
}
