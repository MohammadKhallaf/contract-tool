"use client";
import { useContractStore } from "@/stores/contract-store";
import { generateSchemas } from "@/lib/generators/schema-generator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Loading editor...
    </div>
  ),
});

export function SchemaList() {
  const contract = useContractStore((s) => s.contract);
  const setGeneratedSchemas = useContractStore((s) => s.setGeneratedSchemas);
  const updateSchema = useContractStore((s) => s.updateSchema);
  const { resolvedTheme } = useTheme();

  const schemas = contract?.generatedSchemas ?? [];
  const types = contract?.generatedTypes ?? [];

  function regenerate() {
    if (!contract) return;
    const newSchemas = generateSchemas(contract.generatedTypes, contract.generatedSchemas);
    setGeneratedSchemas(newSchemas);
    toast.success("Schemas regenerated");
  }

  function handleReset(id: string) {
    if (!contract) return;
    const schema = schemas.find((s) => s.id === id);
    if (!schema?.linkedTypeId) return;
    const linkedType = types.find((t) => t.id === schema.linkedTypeId);
    if (!linkedType) return;
    const fresh = generateSchemas([linkedType], []);
    const freshSchema = fresh[0];
    if (freshSchema) {
      updateSchema(id, { code: freshSchema.code, isEdited: false });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schemas.length} schema{schemas.length !== 1 ? "s" : ""} generated
        </p>
        <Button size="sm" variant="outline" onClick={regenerate} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Regenerate
        </Button>
      </div>

      {schemas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No schemas generated yet.</p>
          <p className="text-xs mt-1">Generate types first, then click Regenerate.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {schemas.map((s) => {
            const linkedType = types.find((t) => t.id === s.linkedTypeId);
            return (
              <div key={s.id} className="flex flex-col border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  <span className="text-sm font-mono font-medium">{s.name}</span>
                  {linkedType && (
                    <span className="text-xs text-muted-foreground">
                      from <code>{linkedType.name}</code>
                    </span>
                  )}
                  {s.isEdited && (
                    <Badge variant="secondary" className="text-[10px]">edited</Badge>
                  )}
                  <div className="flex-1" />
                  {s.isEdited && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs gap-1"
                      onClick={() => handleReset(s.id)}
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                  )}
                </div>
                <div className="h-48">
                  <MonacoEditor
                    language="typescript"
                    value={s.code}
                    theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                    onChange={(v) => {
                      if (v !== undefined) updateSchema(s.id, { code: v, isEdited: true });
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
