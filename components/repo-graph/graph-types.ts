export type AnalysisStatus =
  | "queued"
  | "fetching"
  | "scanning"
  | "parsing"
  | "building_graph"
  | "partial"
  | "ready"
  | "failed"
  | "cancelled";

export type GraphNodeType =
  | "repository"
  | "folder"
  | "file"
  | "function"
  | "entry_point"
  | "service"
  | "utility"
  | "dependency"
  | "challenge_candidate";

export type GraphEdgeType =
  | "contains"
  | "imports"
  | "calls"
  | "depends_on"
  | "database_access"
  | "network_access"
  | "candidate_relation";

export interface RepositoryGraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  path?: string;
  language?: string;
  parentId?: string;
  importanceScore?: number;
  complexityScore?: number;
  confidence?: number;
  challengeEligible?: boolean;
  metadata?: Record<string, string | number | boolean>;
  /** Position and layout metadata computed by the layout engine */
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
  depth?: number;
  isCollapsed?: boolean;
}

export interface RepositoryGraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  confidence?: number;
}

export interface RepositoryGraph {
  repositoryId: string;
  repositoryVersionId: string;
  commitSha: string;
  nodes: RepositoryGraphNode[];
  edges: RepositoryGraphEdge[];
  generatedAt: string;
  isPartial: boolean;
  confidence: number;
}
