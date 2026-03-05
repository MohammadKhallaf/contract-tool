"use client";
import { useEffect, useRef } from "react";
import { useAnnotations } from "@/hooks/use-annotations";
import { useUIStore } from "@/stores/ui-store";
import { AnnotationMarker } from "./annotation-marker";

interface Props {
  screenId: string;
  scale: number;
}

export function AnnotationLayer({ screenId, scale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { annotations, placeAnnotation, moveAnnotation, clickMarker } =
    useAnnotations(screenId);
  const isAnnotating = useUIStore((s) => s.isAnnotating);
  const highlightedId = useUIStore((s) => s.highlightedAnnotationId);

  // Wire global drag handler
  useEffect(() => {
    (window as unknown as { __annotMove?: (id: string, x: number, y: number) => void }).__annotMove = moveAnnotation;
    return () => {
      delete (window as unknown as { __annotMove?: unknown }).__annotMove;
    };
  }, [moveAnnotation]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isAnnotating || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    placeAnnotation(x, y);
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
      style={{ cursor: isAnnotating ? "crosshair" : "default" }}
      onClick={handleClick}
    >
      {annotations.map((ann) => (
        <AnnotationMarker
          key={ann.id}
          annotation={ann}
          isHighlighted={highlightedId === ann.id}
          scale={scale}
          onMove={moveAnnotation}
          onClick={clickMarker}
          containerRef={containerRef}
        />
      ))}
    </div>
  );
}
