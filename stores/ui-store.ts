import { create } from "zustand";

export type WorkspacePanel =
  | "jira"
  | "screens"
  | "endpoints"
  | "types"
  | "schemas"
  | "export";

interface UIState {
  activePanel: WorkspacePanel;
  selectedScreenId: string | null;
  selectedEndpointId: string | null;
  highlightedAnnotationId: string | null;
  isAnnotating: boolean;
  setActivePanel: (panel: WorkspacePanel) => void;
  setSelectedScreenId: (id: string | null) => void;
  setSelectedEndpointId: (id: string | null) => void;
  setHighlightedAnnotationId: (id: string | null) => void;
  setIsAnnotating: (v: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activePanel: "jira",
  selectedScreenId: null,
  selectedEndpointId: null,
  highlightedAnnotationId: null,
  isAnnotating: false,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setSelectedScreenId: (id) => set({ selectedScreenId: id }),
  setSelectedEndpointId: (id) => set({ selectedEndpointId: id }),
  setHighlightedAnnotationId: (id) => set({ highlightedAnnotationId: id }),
  setIsAnnotating: (v) => set({ isAnnotating: v }),
}));
