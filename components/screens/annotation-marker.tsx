"use client";
import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import type { Annotation } from "@/types";

interface Props {
  annotation: Annotation;
  isHighlighted: boolean;
  scale: number;
  onClick: (id: string, endpointId?: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function AnnotationMarker({
  annotation,
  isHighlighted,
  scale,
  onClick,
  containerRef,
}: Props) {
  const dragging = useRef(false);
  const startPos = useRef({ mx: 0, my: 0, ax: 0, ay: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dragging.current = true;
      startPos.current = {
        mx: e.clientX,
        my: e.clientY,
        ax: annotation.x,
        ay: annotation.y,
      };

      const onMove = (e: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = (e.clientX - startPos.current.mx) / (rect.width * scale) * 100;
        const dy = (e.clientY - startPos.current.my) / (rect.height * scale) * 100;
        const nx = Math.min(100, Math.max(0, startPos.current.ax + dx));
        const ny = Math.min(100, Math.max(0, startPos.current.ay + dy));
        // emit move
        (window as unknown as { __annotMove?: (id: string, x: number, y: number) => void }).__annotMove?.(annotation.id, nx, ny);
      };

      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [annotation, scale, containerRef]
  );

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
    >
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold cursor-grab select-none border-2 transition-all",
          annotation.endpointId
            ? "bg-green-500 border-green-600 text-white"
            : "bg-blue-500 border-blue-600 text-white",
          isHighlighted && "ring-4 ring-orange-400 ring-offset-1 scale-125"
        )}
        onMouseDown={onMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          onClick(annotation.id, annotation.endpointId);
        }}
        title={`Marker ${annotation.number}${annotation.endpointId ? " (linked)" : " (unlinked)"}${annotation.comment ? `: ${annotation.comment}` : ""}`}
      >
        {annotation.number}
      </div>
      {annotation.comment && (
        <div className="absolute -top-1 -right-1 pointer-events-none">
          <MessageSquare className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
        </div>
      )}
    </div>
  );
}
