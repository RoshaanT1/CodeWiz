"use client";

/**
 * CallMap – React Flow component that shows one function's callers and callees.
 *
 * Public API (all that is needed from outside this folder):
 *   import { CallMap } from "@/components/call-map";
 *   import type { CallMapFunction, CallMapCall } from "@/components/call-map";
 *
 * No data fetching happens inside. The caller passes functions + calls as props.
 */

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FunctionNode } from "./function-node";
import { buildGraph } from "./build-graph";

export type Category = "entry" | "core" | "data" | "helper";

export type CallMapFunction = {
  id: string;
  name: string;
  file?: string;
  category?: Category;
};

export type CallMapCall = {
  callerId: string;
  calleeId: string;
};

export type CallMapProps = {
  functions: CallMapFunction[];
  calls: CallMapCall[];
  /** The function shown in the centre. */
  selectedId: string;
  /** Called when the user clicks a node. Update selectedId here to navigate. */
  onSelect?: (id: string) => void;
  /** Max callers or callees shown on each side. Default: 20. */
  maxNodes?: number;
  /** Override colours per category. */
  categoryColors?: Partial<Record<Category, string>>;
  /** Extra CSS classes on the outer wrapper. */
  className?: string;
};

const nodeTypes: NodeTypes = { function: FunctionNode };

export function CallMap({
  functions,
  calls,
  selectedId,
  onSelect,
  maxNodes = 20,
  categoryColors,
  className,
}: CallMapProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      buildGraph({ functions, calls, selectedId, maxNodes, categoryColors }),
    // Rebuild when these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [functions, calls, selectedId, maxNodes],
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onSelect && node.id !== selectedId) {
        onSelect(node.id);
      }
    },
    [onSelect, selectedId],
  );

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="hsl(var(--border))"
        />
        <Controls
          showInteractive={false}
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        />
        <MiniMap
          nodeColor={(node) => (node.data?.color as string | undefined) ?? "#888"}
          maskColor="hsl(var(--background) / 0.7)"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        />
      </ReactFlow>
    </div>
  );
}
