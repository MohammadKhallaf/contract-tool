"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TypeEditor } from "@/components/types-editor/type-editor";
import { useContractStore } from "@/stores/contract-store";
import { parseFields } from "@/lib/erd/extract-refs";
import { cn } from "@/lib/utils";
import { GripHorizontal, Pencil } from "lucide-react";
import type { GeneratedType } from "@/types";

interface Props {
  type: GeneratedType;
  isHighlighted: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onReset: () => void;
}

const MAX_FIELDS = 6;

export function ErdNode({ type, isHighlighted, onMouseDown, onReset }: Props) {
  const [editing, setEditing] = useState(false);
  const updateType = useContractStore((s) => s.updateType);
  const fields = parseFields(type.code);
  const visibleFields = fields.slice(0, MAX_FIELDS);
  const hiddenCount = fields.length - MAX_FIELDS;

  return (
    <>
      <div
        className={cn(
          "w-64 rounded-lg border bg-card shadow-sm select-none flex flex-col",
          isHighlighted && "ring-2 ring-primary border-primary"
        )}
      >
        {/* Header — drag handle */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 rounded-t-lg cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
        >
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-mono font-semibold truncate flex-1">
            {type.name}
          </span>
          {type.isEdited && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
              edited
            </Badge>
          )}
          {type.linkedEndpointIds.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
              {type.linkedEndpointIds.length}ep
            </Badge>
          )}
        </div>

        {/* Fields */}
        <div className="px-3 py-2 flex-1 min-h-0 space-y-0.5">
          {fields.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No fields</p>
          ) : (
            <>
              {visibleFields.map((f) => (
                <div key={f.name} className="flex items-baseline gap-1.5 leading-5">
                  <span
                    className={cn(
                      "text-[11px] font-mono",
                      f.optional ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {f.name}
                    {f.optional ? "?" : ""}
                  </span>
                  <span className="text-[10px] text-primary/70 font-mono truncate max-w-[120px]">
                    {f.type}
                  </span>
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  +{hiddenCount} more…
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs gap-1 w-full"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-0 shrink-0">
            <DialogTitle className="font-mono text-sm">{type.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">
            <TypeEditor
              type={type}
              onChange={(code) => updateType(type.id, { code, isEdited: true })}
              onReset={onReset}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
