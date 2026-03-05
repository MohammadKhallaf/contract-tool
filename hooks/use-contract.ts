"use client";
import { useContractStore } from "@/stores/contract-store";
import { useContractsListStore } from "@/stores/contracts-list-store";
import { useCallback } from "react";

export function useContractSave() {
  const contract = useContractStore((s) => s.contract);
  const upsert = useContractsListStore((s) => s.upsert);

  const save = useCallback(() => {
    if (!contract) return;
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
