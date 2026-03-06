"use client";
import { useContractStore } from "@/stores/contract-store";
import { useContractsListStore } from "@/stores/contracts-list-store";
import { useCallback } from "react";
import type { Contract } from "@/types";

const CONTRACT_KEY = (id: string) => `contract-tool-contract-${id}`;

export function useContractSave() {
  const contract = useContractStore((s) => s.contract);
  const upsert = useContractsListStore((s) => s.upsert);

  const save = useCallback(() => {
    if (!contract) return;
    // Save full contract data to a per-id key
    localStorage.setItem(CONTRACT_KEY(contract.id), JSON.stringify(contract));
    upsert({
      id: contract.id,
      name: contract.name,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      endpointCount: contract.endpoints.length,
      screenCount: contract.screens.length,
    });
  }, [contract, upsert]);

  return save;
}

/** Load a contract by id from per-id localStorage into the active store. Returns false if not found. */
export function loadContractById(id: string): boolean {
  // Try the per-id key first (new format)
  const raw = localStorage.getItem(CONTRACT_KEY(id));
  if (raw) {
    try {
      const data = JSON.parse(raw) as Contract;
      useContractStore.getState().loadContract(data);
      return true;
    } catch {
      // fall through to legacy lookup
    }
  }

  // Legacy fallback: the Zustand persisted store holds the active contract directly
  const legacyRaw = localStorage.getItem("contract-tool-active-contract");
  if (legacyRaw) {
    try {
      const persisted = JSON.parse(legacyRaw) as { state?: { contract?: Contract } };
      const legacy = persisted?.state?.contract;
      if (legacy?.id === id) {
        // Migrate: write to per-id key so future loads are fast
        localStorage.setItem(CONTRACT_KEY(id), JSON.stringify(legacy));
        useContractStore.getState().loadContract(legacy);
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}
