"use client";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/types";

interface Props {
  annotation: Annotation;
  isHighlighted: boolean;
  onClick: (id: string, endpointId?: string) => void;
}

export function AnnotationRect({ annotation, isHighlighted, onClick }: Props) {
  const { x, y, width = 0, height = 0 } = annotation;

  return (
    <div
      className={cn(
        "absolute border-2 border-dashed border-blue-500 bg-blue-500/10 transition-all cursor-pointer z-10",
        annotation.endpointId && "border-green-500 bg-green-500/10",
        isHighlighted && "ring-2 ring-orange-400 border-orange-400 bg-orange-400/10"
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(annotation.id, annotation.endpointId);
      }}
      title={`Region ${annotation.number}${annotation.comment ? `: ${annotation.comment}` : ""}`}
    >
      {/* Number badge in top-left */}
      <div
        className={cn(
          "absolute -top-3 -left-1 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white select-none",
          annotation.endpointId ? "bg-green-500" : "bg-blue-500",
          isHighlighted && "bg-orange-400"
        )}
      >
        {annotation.number}
      </div>
    </div>
  );
}
