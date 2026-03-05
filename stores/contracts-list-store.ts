import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ContractSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  endpointCount: number;
  screenCount: number;
}

interface ContractsListState {
  contracts: ContractSummary[];
  upsert: (summary: ContractSummary) => void;
  remove: (id: string) => void;
}

export const useContractsListStore = create<ContractsListState>()(
  persist(
    (set) => ({
      contracts: [],
      upsert: (summary) =>
        set((s) => {
          const exists = s.contracts.find((c) => c.id === summary.id);
          if (exists) {
            return {
              contracts: s.contracts.map((c) =>
                c.id === summary.id ? summary : c
              ),
            };
          }
          return { contracts: [summary, ...s.contracts] };
        }),
      remove: (id) =>
        set((s) => ({ contracts: s.contracts.filter((c) => c.id !== id) })),
    }),
    { name: "contract-tool-contracts-list" }
  )
);
