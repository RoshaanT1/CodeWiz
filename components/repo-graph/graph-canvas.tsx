"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RepositoryGraphNode, RepositoryGraphEdge, GraphNodeType } from "./graph-types";

// Design token palette (Cyan, Green, Yellow, Pink, Purple, Low-contrast Blue-Gray)
const PALETTE: Record<GraphNodeType, { top: string; left: string; right: string; glow: string; text: string }> = {
  repository: {
    top: "#38bdf8",
    left: "#0284c7",
    right: "#0369a1",
    glow: "rgba(56, 189, 248, 0.4)",
    text: "#e0f2fe",
  },
  folder: {
    top: "#64748b",
    left: "#475569",
    right: "#334155",
    glow: "rgba(100, 116, 139, 0.3)",
    text: "#f1f5f9",
  },
  file: {
    top: "#94a3b8",
    left: "#64748b",
    right: "#475569",
    glow: "rgba(148, 163, 184, 0.3)",
    text: "#f8fafc",
  },
  function: {
    top: "#a1a1aa",
    left: "#71717a",
    right: "#52525b",
    glow: "rgba(161, 161, 170, 0.25)",
    text: "#fafafa",
  },
  entry_point: {
    top: "#facc15",
    left: "#eab308",
    right: "#ca8a04",
    glow: "rgba(250, 204, 21, 0.45)",
    text: "#fef9c3",
  },
  service: {
    top: "#4ade80",
    left: "#22c55e",
    right: "#16a34a",
    glow: "rgba(74, 222, 128, 0.45)",
    text: "#dcfce7",
  },
  utility: {
    top: "#f472b6",
    left: "#ec4899",
    right: "#db2777",
    glow: "rgba(244, 114, 182, 0.45)",
    text: "#fce7f3",
  },
  dependency: {
    top: "#c084fc",
    left: "#a855f7",
    right: "#9333ea",
    glow: "rgba(192, 132, 252, 0.35)",
    text: "#f3e8ff",
  },
  challenge_candidate: {
    top: "#22d3ee",
    left: "#06b6d4",
    right: "#0891b2",
    glow: "rgba(34, 211, 238, 0.65)",
    text: "#ecfeff",
  },
};

export type GraphCanvasProps = {
  nodes: RepositoryGraphNode[];
  edges: RepositoryGraphEdge[];
  selectedId: string | null;
  onSelectNode: (node: RepositoryGraphNode | null) => void;
  hoveredId: string | null;
  onHoverNode: (node: RepositoryGraphNode | null) => void;
  zoom: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  showGrid: boolean;
  showLabels: boolean;
  is3dCube: boolean;
  animate: boolean;
};

export function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelectNode,
  hoveredId,
  onHoverNode,
  zoom,
  pan,
  onPanChange,
  showGrid,
  showLabels,
  is3dCube,
  animate,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pulsePhaseRef = useRef(0);

  // Compute connected node IDs for highlighting
  const activeConnectedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const s = new Set<string>();
    if (selectedId) {
      s.add(selectedId);
      for (const edge of edges) {
        if (edge.source === selectedId) s.add(edge.target);
        if (edge.target === selectedId) s.add(edge.source);
      }
    }
    activeConnectedIds.current = s;
  }, [selectedId, edges]);

  // Main render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply pan & zoom
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw subtle background grid
    if (showGrid) {
      const gridSize = 40;
      const minX = (-width / 2 - pan.x) / zoom;
      const maxX = (width / 2 - pan.x) / zoom;
      const minY = (-height / 2 - pan.y) / zoom;
      const maxY = (height / 2 - pan.y) / zoom;

      ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      const startX = Math.floor(minX / gridSize) * gridSize;
      for (let x = startX; x <= maxX; x += gridSize) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
      }
      const startY = Math.floor(minY / gridSize) * gridSize;
      for (let y = startY; y <= maxY; y += gridSize) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
    }

    // Node lookup map
    const nodeMap = new Map<string, RepositoryGraphNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    const hasSelection = selectedId !== null;
    const connected = activeConnectedIds.current;

    // 2. Draw Edges
    for (const edge of edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const isEdgeActive =
        hasSelection && (edge.source === selectedId || edge.target === selectedId);
      const isDimmed = hasSelection && !isEdgeActive;

      ctx.lineWidth = isEdgeActive ? 2 / zoom : 1 / zoom;

      if (edge.type === "calls") {
        ctx.strokeStyle = isEdgeActive
          ? "#22d3ee"
          : isDimmed
          ? "rgba(34, 211, 238, 0.1)"
          : "rgba(34, 211, 238, 0.45)";
      } else if (edge.type === "database_access") {
        ctx.strokeStyle = isEdgeActive
          ? "#facc15"
          : isDimmed
          ? "rgba(250, 204, 21, 0.1)"
          : "rgba(250, 204, 21, 0.4)";
      } else {
        ctx.strokeStyle = isEdgeActive
          ? "#60a5fa"
          : isDimmed
          ? "rgba(71, 85, 105, 0.1)"
          : "rgba(71, 85, 105, 0.35)";
      }

      ctx.beginPath();
      ctx.moveTo(src.x ?? 0, src.y ?? 0);
      // Draw smooth quadratic bezier curve
      const midX = ((src.x ?? 0) + (tgt.x ?? 0)) / 2;
      const midY = ((src.y ?? 0) + (tgt.y ?? 0)) / 2 - 10;
      ctx.quadraticCurveTo(midX, midY, tgt.x ?? 0, tgt.y ?? 0);
      ctx.stroke();
    }

    // 3. Draw Nodes
    pulsePhaseRef.current += 0.04;
    const pulse = (Math.sin(pulsePhaseRef.current) + 1) / 2;

    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = node.radius ?? 14;
      const isSelected = node.id === selectedId;
      const isHovered = node.id === hoveredId;
      const isConnected = connected.has(node.id);
      const isDimmed = hasSelection && !isSelected && !isConnected;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

      const colors = PALETTE[node.type] || PALETTE.function;

      // Glow halo on selected / candidate
      if (isSelected || (node.type === "challenge_candidate" && !isDimmed)) {
        ctx.save();
        const glowRadius = isSelected ? radius * 2.2 + pulse * 4 : radius * 1.6;
        const grad = ctx.createRadialGradient(x, y, radius * 0.5, x, y, glowRadius);
        grad.addColorStop(0, colors.glow);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (is3dCube) {
        // Draw 3D Isometric Cube Node
        drawIsometricCube(ctx, x, y, radius, colors);
      } else {
        // Flat technical circle
        ctx.fillStyle = colors.top;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colors.left;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Selection indicator ring
      if (isSelected || isHovered) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Labels (Level-of-detail: show all if zoomed in, or if selected/hovered)
      const shouldDrawLabel =
        showLabels && (zoom >= 0.7 || node.type === "repository" || isSelected || isHovered);

      if (shouldDrawLabel) {
        ctx.font = `${Math.max(10, Math.min(12, 11 / zoom))}px ui-monospace, monospace`;
        ctx.fillStyle = isSelected ? "#38bdf8" : isDimmed ? "rgba(148, 163, 184, 0.4)" : colors.text;
        ctx.textAlign = "center";
        ctx.fillText(node.name, x, y + radius + 14);
      }

      ctx.restore();
    }

    ctx.restore();
  }, [nodes, edges, selectedId, hoveredId, zoom, pan, showGrid, showLabels, is3dCube]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    function loop() {
      render();
      if (animate) {
        animId = requestAnimationFrame(loop);
      }
    }
    loop();
    return () => cancelAnimationFrame(animId);
  }, [render, animate]);

  // Window resize handler
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      render();
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  // Mouse interaction & Hit Testing
  const getNodeAt = useCallback(
    (clientX: number, clientY: number): RepositoryGraphNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      // Transform mouse coordinates to graph space
      const graphX = (mouseX - rect.width / 2 - pan.x) / zoom;
      const graphY = (mouseY - rect.height / 2 - pan.y) / zoom;

      // Reverse iterate to hit frontmost nodes first
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = graphX - (node.x ?? 0);
        const dy = graphY - (node.y ?? 0);
        const hitRadius = (node.radius ?? 14) + 6;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return node;
        }
      }
      return null;
    },
    [nodes, pan, zoom],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      onPanChange({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    } else {
      const hit = getNodeAt(e.clientX, e.clientY);
      onHoverNode(hit);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const dist =
        Math.hypot(e.clientX - (dragStartRef.current.x + pan.x), e.clientY - (dragStartRef.current.y + pan.y));
      isDraggingRef.current = false;
      // If minimal drag distance, treat as click
      if (dist < 4) {
        const hit = getNodeAt(e.clientX, e.clientY);
        onSelectNode(hit);
      }
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-[#05070a]">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="h-full w-full cursor-grab active:cursor-grabbing block"
      />
    </div>
  );
}

/**
 * Draws an isometric 3D cube onto the 2D canvas context.
 */
function drawIsometricCube(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colors: { top: string; left: string; right: string },
) {
  const h = size * 0.7;
  const w = size;

  // 1. Top face (rhombus)
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy - h * 0.4);
  ctx.lineTo(cx, cy + h * 0.2);
  ctx.lineTo(cx - w, cy - h * 0.4);
  ctx.closePath();
  ctx.fill();

  // 2. Left face
  ctx.fillStyle = colors.left;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h * 0.4);
  ctx.lineTo(cx, cy + h * 0.2);
  ctx.lineTo(cx, cy + h * 1.1);
  ctx.lineTo(cx - w, cy + h * 0.5);
  ctx.closePath();
  ctx.fill();

  // 3. Right face
  ctx.fillStyle = colors.right;
  ctx.beginPath();
  ctx.moveTo(cx + w, cy - h * 0.4);
  ctx.lineTo(cx, cy + h * 0.2);
  ctx.lineTo(cx, cy + h * 1.1);
  ctx.lineTo(cx + w, cy + h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Thin structural highlights
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy - h * 0.4);
  ctx.lineTo(cx, cy + h * 0.2);
  ctx.lineTo(cx - w, cy - h * 0.4);
  ctx.closePath();
  ctx.stroke();
}
