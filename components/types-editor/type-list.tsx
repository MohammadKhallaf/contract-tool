"use client";
import { useContractStore } from "@/stores/contract-store";
import { generateTypes } from "@/lib/generators/type-generator";
import { TypeEditor } from "./type-editor";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function TypeList() {
  const contract = useContractStore((s) => s.contract);
  const setGeneratedTypes = useContractStore((s) => s.setGeneratedTypes);
  const updateType = useContractStore((s) => s.updateType);

  const types = contract?.generatedTypes ?? [];

  function regenerate() {
    if (!contract) return;
    const newTypes = generateTypes(contract.endpoints, contract.generatedTypes);
    setGeneratedTypes(newTypes);
    toast.success("Types regenerated");
  }

  function handleChange(id: string, code: string) {
    updateType(id, { code, isEdited: true });
  }

  function handleReset(id: string) {
    if (!contract) return;
    const ep = contract.endpoints.find((e) =>
      contract.generatedTypes.find((t) => t.id === id)?.linkedEndpointIds.includes(e.id)
    );
    if (!ep) return;
    const fresh = generateTypes([ep], []);
    const freshType = fresh.find((t) => {
      const existing = contract.generatedTypes.find((gt) => gt.id === id);
      return t.name === existing?.name;
    });
    if (freshType) {
      updateType(id, { code: freshType.code, isEdited: false });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {types.length} type{types.length !== 1 ? "s" : ""} generated
        </p>
        <Button size="sm" variant="outline" onClick={regenerate} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Regenerate
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No types generated yet.</p>
          <p className="text-xs mt-1">Add endpoints first, then click Regenerate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {types.map((t) => (
            <div key={t.id} className="h-64">
              <TypeEditor
                type={t}
                onChange={(code) => handleChange(t.id, code)}
                onReset={() => handleReset(t.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
