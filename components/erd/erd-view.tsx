"use client";
import { useState, useEffect, useCallback } from "react";
import { useContractStore } from "@/stores/contract-store";
import { generateTypes } from "@/lib/generators/type-generator";
import { extractRefs } from "@/lib/erd/extract-refs";
import { ErdCanvas, type NodePos, type Edge } from "./erd-canvas";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Maximize2, Network } from "lucide-react";

const COL_COUNT = 4;
const H_GAP = 300;
const V_GAP = 260;
const OFFSET_X = 20;
const OFFSET_Y = 20;

function computeGridLayout(ids: string[]): NodePos[] {
  return ids.map((id, i) => ({
    id,
    x: OFFSET_X + (i % COL_COUNT) * H_GAP,
    y: OFFSET_Y + Math.floor(i / COL_COUNT) * V_GAP,
  }));
}

export function ErdView() {
  const contract = useContractStore((s) => s.contract);
  const updateType = useContractStore((s) => s.updateType);
  const types = contract?.generatedTypes ?? [];

  const [positions, setPositions] = useState<NodePos[]>([]);

  // Re-initialise layout when types list changes length
  useEffect(() => {
    setPositions(computeGridLayout(types.map((t) => t.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.length]);

  const allTypeNames = types.map((t) => t.name);

  const edges: Edge[] = types.flatMap((type) =>
    extractRefs(type.code, type.name, allTypeNames).map((refName) => {
      const target = types.find((t) => t.name === refName);
      return target ? { sourceId: type.id, targetId: target.id } : null;
    }).filter(Boolean) as Edge[]
  );

  function handleReset(id: string) {
    if (!contract) return;
    const ep = contract.endpoints.find((e) =>
      contract.generatedTypes.find((t) => t.id === id)?.linkedEndpointIds.includes(e.id)
    );
    if (!ep) return;
    const fresh = generateTypes([ep], []);
    const existing = contract.generatedTypes.find((t) => t.id === id);
    const freshType = fresh.find((t) => t.name === existing?.name);
    if (freshType) {
      updateType(id, { code: freshType.code, isEdited: false });
    }
  }

  function handleFit() {
    // Reset to default layout with a pan/zoom reset via re-mounting
    // Simple approach: just reset grid and let canvas start fresh
    setPositions(computeGridLayout(types.map((t) => t.id)));
  }

  const handlePositionsChange = useCallback((p: NodePos[]) => {
    setPositions(p);
  }, []);

  if (types.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Network className="h-10 w-10 opacity-30" />
        <p className="text-sm">No types generated yet.</p>
        <p className="text-xs">Generate types from endpoints to see the ERD.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
        <Network className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {types.length} type{types.length !== 1 ? "s" : ""} &middot; {edges.length} relation{edges.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleFit}>
          <LayoutGrid className="h-3.5 w-3.5" /> Reset layout
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          title="Scroll to zoom, drag background to pan"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Scroll to zoom
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <ErdCanvas
          types={types}
          positions={positions}
          edges={edges}
          onPositionsChange={handlePositionsChange}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
