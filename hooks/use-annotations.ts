"use client";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

export function useAnnotations(screenId: string) {
  const annotations = useContractStore(
    useShallow((s) => s.contract?.annotations.filter((a) => a.screenId === screenId) ?? [])
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
      addAnnotation({ screenId, x, y, kind: "point" });
    },
    [isAnnotating, addAnnotation, screenId]
  );

  const placeRect = useCallback(
    (x: number, y: number, width: number, height: number) => {
      if (!isAnnotating) return;
      addAnnotation({ screenId, x, y, kind: "rect", width, height });
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
    placeRect,
    moveAnnotation,
    linkAnnotation,
    removeAnnotation,
    clickMarker,
  };
}
