"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { ErdNode } from "./erd-node";
import type { GeneratedType } from "@/types";

export interface NodePos {
  id: string;
  x: number;
  y: number;
}

export interface Edge {
  sourceId: string;
  targetId: string;
}

interface Props {
  types: GeneratedType[];
  positions: NodePos[];
  edges: Edge[];
  onPositionsChange: (positions: NodePos[]) => void;
  onReset: (id: string) => void;
}

const NODE_WIDTH = 256;
const NODE_HEIGHT = 220; // approximate, for edge anchoring

export function ErdCanvas({ types, positions, edges, onPositionsChange, onReset }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Pan via background drag
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Node drag
  const draggingId = useRef<string | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, nx: 0, ny: 0 });

  const posMap = useRef<Map<string, NodePos>>(new Map());
  useEffect(() => {
    posMap.current = new Map(positions.map((p) => [p.id, p]));
  }, [positions]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)));
  }, []);

  // Background mousedown → start pan
  function handleBgMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
  }

  // Node mousedown → start drag
  function handleNodeMouseDown(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    draggingId.current = id;
    const pos = posMap.current.get(id)!;
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: pos.x, ny: pos.y };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (isPanning.current) {
        const dx = (e.clientX - panStart.current.x) / scale;
        const dy = (e.clientY - panStart.current.y) / scale;
        setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
      }
      if (draggingId.current) {
        const dx = (e.clientX - dragStart.current.mx) / scale;
        const dy = (e.clientY - dragStart.current.my) / scale;
        const newX = dragStart.current.nx + dx;
        const newY = dragStart.current.ny + dy;
        posMap.current.set(draggingId.current, {
          id: draggingId.current,
          x: newX,
          y: newY,
        });
        // live update DOM for performance
        const el = document.getElementById(`erd-node-${draggingId.current}`);
        if (el) {
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
        }
        // redraw edges via state
        onPositionsChange([...posMap.current.values()]);
      }
    }
    function onMouseUp() {
      isPanning.current = false;
      if (draggingId.current) {
        onPositionsChange([...posMap.current.values()]);
        draggingId.current = null;
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [scale, onPositionsChange]);

  // Compute SVG dimensions to cover all nodes
  const maxX = Math.max(...positions.map((p) => p.x + NODE_WIDTH), 800);
  const maxY = Math.max(...positions.map((p) => p.y + NODE_HEIGHT), 600);
  const svgW = maxX + 100;
  const svgH = maxY + 100;

  // Edge paths
  function edgePath(src: NodePos, tgt: NodePos): string {
    const x1 = src.x + NODE_WIDTH;
    const y1 = src.y + NODE_HEIGHT / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + NODE_HEIGHT / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  const posById = new Map(positions.map((p) => [p.id, p]));

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-muted/20 cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleBgMouseDown}
      style={{ userSelect: "none" }}
    >
      <div
        style={{
          transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "0 0",
          position: "relative",
          width: svgW,
          height: svgH,
        }}
      >
        {/* SVG edge layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgW}
          height={svgH}
          style={{ zIndex: 1 }}
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" className="fill-primary/50" />
            </marker>
            <marker
              id="arrow-active"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" className="fill-primary" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const src = posById.get(edge.sourceId);
            const tgt = posById.get(edge.targetId);
            if (!src || !tgt) return null;
            const isActive =
              hoveredId === edge.sourceId || hoveredId === edge.targetId;
            return (
              <path
                key={`${edge.sourceId}-${edge.targetId}`}
                d={edgePath(src, tgt)}
                fill="none"
                strokeWidth={isActive ? 2 : 1.5}
                markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow)"}
                className={
                  isActive ? "stroke-primary" : "stroke-primary/30"
                }
              />
            );
          })}
        </svg>

        {/* Node layer */}
        {types.map((type) => {
          const pos = posById.get(type.id);
          if (!pos) return null;
          const isHighlighted =
            hoveredId !== null &&
            (hoveredId === type.id ||
              edges.some(
                (e) =>
                  (e.sourceId === hoveredId && e.targetId === type.id) ||
                  (e.targetId === hoveredId && e.sourceId === type.id)
              ));
          return (
            <div
              key={type.id}
              id={`erd-node-${type.id}`}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                zIndex: 10,
              }}
              onMouseEnter={() => setHoveredId(type.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <ErdNode
                type={type}
                isHighlighted={isHighlighted}
                onMouseDown={(e) => handleNodeMouseDown(type.id, e)}
                onReset={() => onReset(type.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
