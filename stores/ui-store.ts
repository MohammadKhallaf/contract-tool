import { create } from "zustand";

export type WorkspacePanel =
  | "jira"
  | "screens"
  | "endpoints"
  | "types"
  | "schemas"
  | "erd"
  | "export"
  | "be-handoff";

export type AnnotationMode = "point" | "rect";

interface UIState {
  activePanel: WorkspacePanel;
  selectedScreenId: string | null;
  selectedEndpointId: string | null;
  highlightedAnnotationId: string | null;
  isAnnotating: boolean;
  annotationMode: AnnotationMode;
  setActivePanel: (panel: WorkspacePanel) => void;
  setSelectedScreenId: (id: string | null) => void;
  setSelectedEndpointId: (id: string | null) => void;
  setHighlightedAnnotationId: (id: string | null) => void;
  setIsAnnotating: (v: boolean) => void;
  setAnnotationMode: (mode: AnnotationMode) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activePanel: "jira",
  selectedScreenId: null,
  selectedEndpointId: null,
  highlightedAnnotationId: null,
  isAnnotating: false,
  annotationMode: "point",
  setActivePanel: (panel) => set({ activePanel: panel }),
  setSelectedScreenId: (id) => set({ selectedScreenId: id }),
  setSelectedEndpointId: (id) => set({ selectedEndpointId: id }),
  setHighlightedAnnotationId: (id) => set({ highlightedAnnotationId: id }),
  setIsAnnotating: (v) => set({ isAnnotating: v }),
  setAnnotationMode: (mode) => set({ annotationMode: mode }),
}));
