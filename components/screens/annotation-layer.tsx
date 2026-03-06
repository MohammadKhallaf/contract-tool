"use client";
import { useEffect, useRef, useState } from "react";
import { useAnnotations } from "@/hooks/use-annotations";
import { useUIStore } from "@/stores/ui-store";
import { AnnotationMarker } from "./annotation-marker";
import { AnnotationRect } from "./annotation-rect";

interface Props {
  screenId: string;
  scale: number;
}

interface DraftRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function AnnotationLayer({ screenId, scale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { annotations, placeAnnotation, placeRect, moveAnnotation, clickMarker } =
    useAnnotations(screenId);
  const isAnnotating = useUIStore((s) => s.isAnnotating);
  const annotationMode = useUIStore((s) => s.annotationMode);
  const highlightedId = useUIStore((s) => s.highlightedAnnotationId);

  const [draft, setDraft] = useState<DraftRect | null>(null);
  const drawingRef = useRef(false);

  // Wire global drag handler for point markers
  useEffect(() => {
    (window as unknown as { __annotMove?: (id: string, x: number, y: number) => void }).__annotMove = moveAnnotation;
    return () => {
      delete (window as unknown as { __annotMove?: unknown }).__annotMove;
    };
  }, [moveAnnotation]);

  function getPct(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isAnnotating || annotationMode !== "point") return;
    const { x, y } = getPct(e);
    placeAnnotation(x, y);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!isAnnotating || annotationMode !== "rect") return;
    e.preventDefault();
    drawingRef.current = true;
    const { x, y } = getPct(e);
    setDraft({ startX: x, startY: y, endX: x, endY: y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawingRef.current || !draft) return;
    const { x, y } = getPct(e);
    setDraft((d) => d ? { ...d, endX: x, endY: y } : null);
  }

  function handleMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawingRef.current || !draft) return;
    drawingRef.current = false;
    const { x, y } = getPct(e);
    const finalDraft = { ...draft, endX: x, endY: y };
    setDraft(null);

    const rx = Math.min(finalDraft.startX, finalDraft.endX);
    const ry = Math.min(finalDraft.startY, finalDraft.endY);
    const rw = Math.abs(finalDraft.endX - finalDraft.startX);
    const rh = Math.abs(finalDraft.endY - finalDraft.startY);

    // Ignore tiny drags (less than 2%)
    if (rw < 2 || rh < 2) return;
    placeRect(rx, ry, rw, rh);
  }

  // Compute preview rect geometry
  const previewStyle = draft
    ? {
        left: `${Math.min(draft.startX, draft.endX)}%`,
        top: `${Math.min(draft.startY, draft.endY)}%`,
        width: `${Math.abs(draft.endX - draft.startX)}%`,
        height: `${Math.abs(draft.endY - draft.startY)}%`,
      }
    : null;

  const pointAnnotations = annotations.filter((a) => !a.kind || a.kind === "point");
  const rectAnnotations = annotations.filter((a) => a.kind === "rect");

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ cursor: isAnnotating ? "crosshair" : "default" }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Point markers */}
      {pointAnnotations.map((ann) => (
        <AnnotationMarker
          key={ann.id}
          annotation={ann}
          isHighlighted={highlightedId === ann.id}
          scale={scale}
          onClick={clickMarker}
          containerRef={containerRef}
        />
      ))}

      {/* Rect regions */}
      {rectAnnotations.map((ann) => (
        <AnnotationRect
          key={ann.id}
          annotation={ann}
          isHighlighted={highlightedId === ann.id}
          onClick={clickMarker}
        />
      ))}

      {/* Live preview while drawing */}
      {previewStyle && (
        <div
          className="absolute border-2 border-dashed border-blue-400 bg-blue-400/10 pointer-events-none"
          style={previewStyle}
        />
      )}
    </div>
  );
}
