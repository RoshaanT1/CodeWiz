import type {
  RepositoryGraph,
  RepositoryGraphNode,
  RepositoryGraphEdge,
  GraphNodeType,
} from "./graph-types";

export type RawFunctionInput = {
  id: string;
  name: string;
  qualifiedName?: string | null;
  filePath: string;
  language?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  callers?: number | null;
  callees?: number | null;
  branches?: number | null;
  dataAccess?: boolean | null;
  category?: "entry" | "core" | "data" | "helper" | null;
  importance?: number | null;
  explained?: boolean;
};

export type RawRepoInput = {
  id: string;
  owner: string;
  name: string;
  branch?: string;
  url?: string;
  commitSha?: string | null;
  status?: string;
};

export type RawCallInput = {
  callerId: string;
  calleeId: string;
};

/**
 * Transforms relational repository functions and calls into a hierarchical
 * graph containing Repository, Folder, File, and categorized Function nodes
 * with layout coordinates and relationship edges.
 */
export function transformRepoToGraph(
  repo: RawRepoInput,
  functions: RawFunctionInput[],
  calls: RawCallInput[] = [],
): RepositoryGraph {
  const nodes: RepositoryGraphNode[] = [];
  const edges: RepositoryGraphEdge[] = [];

  const repoNodeId = `repo:${repo.id}`;
  nodes.push({
    id: repoNodeId,
    type: "repository",
    name: `${repo.owner}/${repo.name}`,
    path: "/",
    importanceScore: 1.0,
    confidence: 1.0,
    x: 0,
    y: 0,
    depth: 0,
    radius: 36,
  });

  const folderMap = new Map<string, RepositoryGraphNode>();
  const fileMap = new Map<string, RepositoryGraphNode>();

  // Extract unique folders and files
  for (const fn of functions) {
    const filePath = fn.filePath || "unknown";
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts[parts.length - 1] || filePath;
    const folderPath = parts.slice(0, -1).join("/") || "root";

    // Ensure folder node exists
    if (!folderMap.has(folderPath)) {
      const folderId = `folder:${folderPath}`;
      const folderNode: RepositoryGraphNode = {
        id: folderId,
        type: "folder",
        name: folderPath,
        path: folderPath,
        parentId: repoNodeId,
        depth: 1,
        radius: 24,
      };
      folderMap.set(folderPath, folderNode);
      nodes.push(folderNode);

      edges.push({
        id: `edge:${repoNodeId}->${folderId}`,
        source: repoNodeId,
        target: folderId,
        type: "contains",
      });
    }

    // Ensure file node exists
    if (!fileMap.has(filePath)) {
      const fileId = `file:${filePath}`;
      const parentFolderId = `folder:${folderPath}`;
      const fileNode: RepositoryGraphNode = {
        id: fileId,
        type: "file",
        name: fileName,
        path: filePath,
        language: fn.language ?? undefined,
        parentId: parentFolderId,
        depth: 2,
        radius: 18,
      };
      fileMap.set(filePath, fileNode);
      nodes.push(fileNode);

      edges.push({
        id: `edge:${parentFolderId}->${fileId}`,
        source: parentFolderId,
        target: fileId,
        type: "contains",
      });
    }

    // Determine function node type
    let fnType: GraphNodeType = "function";
    const importance = fn.importance ?? 0;
    const isCandidate = !fn.explained && importance >= 0.45;

    if (isCandidate) {
      fnType = "challenge_candidate";
    } else if (fn.category === "entry" || importance >= 0.75) {
      fnType = "entry_point";
    } else if (fn.category === "core" || fn.dataAccess || (fn.callers ?? 0) >= 3) {
      fnType = "service";
    } else if (fn.category === "helper") {
      fnType = "utility";
    }

    const fileId = `file:${filePath}`;
    const fnNode: RepositoryGraphNode = {
      id: fn.id,
      type: fnType,
      name: fn.qualifiedName || fn.name,
      path: `${filePath}:${fn.startLine ?? 1}`,
      language: fn.language ?? undefined,
      parentId: fileId,
      importanceScore: importance,
      complexityScore: fn.branches ?? 1,
      confidence: 0.95,
      challengeEligible: isCandidate,
      depth: 3,
      radius: fnType === "challenge_candidate" ? 16 : 14,
      metadata: {
        startLine: fn.startLine ?? 1,
        endLine: fn.endLine ?? 1,
        callers: fn.callers ?? 0,
        callees: fn.callees ?? 0,
        branches: fn.branches ?? 0,
        explained: fn.explained ?? false,
      },
    };
    nodes.push(fnNode);

    edges.push({
      id: `edge:${fileId}->${fn.id}`,
      source: fileId,
      target: fn.id,
      type: "contains",
    });

    if (fn.dataAccess) {
      edges.push({
        id: `edge:data:${fn.id}`,
        source: fn.id,
        target: fn.id,
        type: "database_access",
      });
    }
  }

  // Add call edges between functions
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const call of calls) {
    if (nodeIds.has(call.callerId) && nodeIds.has(call.calleeId)) {
      edges.push({
        id: `call:${call.callerId}->${call.calleeId}`,
        source: call.callerId,
        target: call.calleeId,
        type: "calls",
      });
    }
  }

  // Radial / circular initial layout distribution
  applyRadialLayout(nodes);

  return {
    repositoryId: repo.id,
    repositoryVersionId: repo.commitSha || "head",
    commitSha: repo.commitSha || "main",
    nodes,
    edges,
    generatedAt: new Date().toISOString(),
    isPartial: repo.status !== "indexed",
    confidence: repo.status === "indexed" ? 0.96 : 0.65,
  };
}

/**
 * Distribute nodes in concentric orbits based on hierarchy depth.
 */
function applyRadialLayout(nodes: RepositoryGraphNode[]): void {
  const folders = nodes.filter((n) => n.type === "folder");
  const files = nodes.filter((n) => n.type === "file");
  const functions = nodes.filter((n) =>
    ["function", "entry_point", "service", "utility", "challenge_candidate"].includes(n.type),
  );

  // Folders orbit at radius 160px
  const folderRadius = 160;
  folders.forEach((f, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, folders.length);
    f.x = Math.cos(angle) * folderRadius;
    f.y = Math.sin(angle) * folderRadius;
  });

  // Files orbit their parent folder at radius 100px
  const filesByFolder = new Map<string, RepositoryGraphNode[]>();
  for (const file of files) {
    const pid = file.parentId || "";
    if (!filesByFolder.has(pid)) filesByFolder.set(pid, []);
    filesByFolder.get(pid)!.push(file);
  }

  for (const [folderId, folderFiles] of filesByFolder.entries()) {
    const parent = folders.find((f) => f.id === folderId);
    const px = parent?.x ?? 0;
    const py = parent?.y ?? 0;
    const r = 90;
    folderFiles.forEach((file, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, folderFiles.length);
      file.x = px + Math.cos(angle) * r;
      file.y = py + Math.sin(angle) * r;
    });
  }

  // Functions orbit their parent file at radius 55px
  const fnsByFile = new Map<string, RepositoryGraphNode[]>();
  for (const fn of functions) {
    const pid = fn.parentId || "";
    if (!fnsByFile.has(pid)) fnsByFile.set(pid, []);
    fnsByFile.get(pid)!.push(fn);
  }

  for (const [fileId, fileFns] of fnsByFile.entries()) {
    const parent = files.find((f) => f.id === fileId);
    const px = parent?.x ?? 0;
    const py = parent?.y ?? 0;
    const r = 50;
    fileFns.forEach((fn, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, fileFns.length);
      fn.x = px + Math.cos(angle) * r;
      fn.y = py + Math.sin(angle) * r;
    });
  }
}
