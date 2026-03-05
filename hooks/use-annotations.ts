"use client";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { useCallback } from "react";

export function useAnnotations(screenId: string) {
  const annotations = useContractStore((s) =>
    s.contract?.annotations.filter((a) => a.screenId === screenId) ?? []
  );
  const addAnnotation = useContractStore((s) => s.addAnnotation);
  const moveAnnotation = useContractStore((s) => s.moveAnnotation);
  const linkAnnotation = useContractStore((s) => s.linkAnnotation);
  const removeAnnotation = useContractStore((s) => s.removeAnnotation);
  const isAnnotating = useUIStore((s) => s.isAnnotating);
  const setHighlightedAnnotationId = useUIStore(
    (s) => s.setHighlightedAnnotationId
  );
  const setSelectedEndpointId = useUIStore((s) => s.setSelectedEndpointId);

  const placeAnnotation = useCallback(
    (x: number, y: number) => {
      if (!isAnnotating) return;
      addAnnotation({ screenId, x, y });
    },
    [isAnnotating, addAnnotation, screenId]
  );

  const clickMarker = useCallback(
    (annotationId: string, endpointId?: string) => {
      setHighlightedAnnotationId(annotationId);
      if (endpointId) setSelectedEndpointId(endpointId);
    },
    [setHighlightedAnnotationId, setSelectedEndpointId]
  );

  return {
    annotations,
    placeAnnotation,
    moveAnnotation,
    linkAnnotation,
    removeAnnotation,
    clickMarker,
  };
}
