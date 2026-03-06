"use client";
import { useCallback, useRef } from "react";
import { useImageViewer } from "@/hooks/use-image-viewer";
import { AnnotationLayer } from "./annotation-layer";
import { AnnotationLegend } from "./annotation-legend";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, MapPin, Square } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useContractStore } from "@/stores/contract-store";
import { cn } from "@/lib/utils";
import type { Screen } from "@/types";

interface Props {
  screen: Screen;
}

export function ScreenViewer({ screen }: Props) {
  const { scale, offset, isDragging, onWheel, onMouseDown, onMouseMove, onMouseUp, reset } =
    useImageViewer();
  const isAnnotating = useUIStore((s) => s.isAnnotating);
  const setIsAnnotating = useUIStore((s) => s.setIsAnnotating);
  const annotationMode = useUIStore((s) => s.annotationMode);
  const setAnnotationMode = useUIStore((s) => s.setAnnotationMode);
  const updateScreen = useContractStore((s) => s.updateScreen);

  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = useCallback(
    (value: string) => {
      if (notesTimeout.current) clearTimeout(notesTimeout.current);
      notesTimeout.current = setTimeout(() => {
        updateScreen(screen.id, { notes: value || undefined });
      }, 500);
    },
    [screen.id, updateScreen]
  );

  return (
    <div className="flex gap-4 h-full">
      {/* Viewer */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Toolbar */}
        <div className="flex items-center gap-1">
          {/* Annotate toggle */}
          <Button
            size="sm"
            variant={isAnnotating ? "default" : "outline"}
            onClick={() => setIsAnnotating(!isAnnotating)}
            className="gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" />
            {isAnnotating ? "Annotating" : "Annotate"}
          </Button>

          {/* Mode segmented control — only visible when annotating */}
          {isAnnotating && (
            <div className="flex rounded-md border overflow-hidden">
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "rounded-none h-8 gap-1 px-2 text-xs",
                  annotationMode === "point" && "bg-primary text-primary-foreground"
                )}
                onClick={() => setAnnotationMode("point")}
              >
                <MapPin className="h-3 w-3" />
                Point
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "rounded-none h-8 gap-1 px-2 text-xs border-l",
                  annotationMode === "rect" && "bg-primary text-primary-foreground"
                )}
                onClick={() => setAnnotationMode("rect")}
              >
                <Square className="h-3 w-3" />
                Rect
              </Button>
            </div>
          )}

          <div className="flex-1" />
          <Button size="icon" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Image canvas */}
        <div
          className="relative flex-1 overflow-hidden rounded-lg border bg-checkerboard"
          onWheel={onWheel}
          onMouseDown={!isAnnotating ? onMouseDown : undefined}
          onMouseMove={!isAnnotating ? onMouseMove : undefined}
          onMouseUp={!isAnnotating ? onMouseUp : undefined}
          style={{ cursor: isDragging ? "grabbing" : isAnnotating ? "crosshair" : scale > 1 ? "grab" : "default" }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transformOrigin: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screen.dataUrl}
              alt={screen.name}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
            <AnnotationLayer screenId={screen.id} scale={scale} />
          </div>
        </div>

        {/* Per-screen notes */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Screen Notes
          </p>
          <Textarea
            placeholder="Add notes for AI context (e.g. 'this is the auth flow', 'ignore the nav bar')..."
            className="h-20 text-sm resize-none"
            defaultValue={screen.notes ?? ""}
            onChange={(e) => handleNotesChange(e.target.value)}
          />
        </div>
      </div>

      {/* Legend sidebar */}
      <div className="w-64 shrink-0 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Annotations
        </p>
        <AnnotationLegend screenId={screen.id} />
      </div>
    </div>
  );
}
