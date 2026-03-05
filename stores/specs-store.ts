import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ParsedSpec } from "@/types";

interface SpecsState {
  specs: Record<string, ParsedSpec>; // keyed by project name
  setSpec: (project: string, spec: ParsedSpec) => void;
  removeSpec: (project: string) => void;
  clearAll: () => void;
}

export const useSpecsStore = create<SpecsState>()(
  persist(
    (set) => ({
      specs: {},
      setSpec: (project, spec) =>
        set((s) => ({ specs: { ...s.specs, [project]: spec } })),
      removeSpec: (project) =>
        set((s) => {
          const specs = { ...s.specs };
          delete specs[project];
          return { specs };
        }),
      clearAll: () => set({ specs: {} }),
    }),
    { name: "contract-tool-specs" }
  )
);
