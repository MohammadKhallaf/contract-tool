"use client";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Square, MapPin, Link2 } from "lucide-react";
import type { ScreenRelation } from "@/types";

const RELATION_LABELS: Record<ScreenRelation["type"], string> = {
  popup_on: "Popup on",
  opens_page: "Opens page",
  linked_to: "Linked to",
};

interface Props {
  screenId: string;
}

export function AnnotationLegend({ screenId }: Props) {
  const annotations = useContractStore(
    useShallow((s) => s.contract?.annotations.filter((a) => a.screenId === screenId) ?? [])
  );
  const endpoints = useContractStore(
    useShallow((s) => s.contract?.endpoints ?? [])
  );
  const screens = useContractStore(
    useShallow((s) => s.contract?.screens ?? [])
  );
  const linkAnnotation = useContractStore((s) => s.linkAnnotation);
  const updateAnnotation = useContractStore((s) => s.updateAnnotation);
  const removeAnnotation = useContractStore((s) => s.removeAnnotation);
  const setHighlightedAnnotationId = useUIStore(
    (s) => s.setHighlightedAnnotationId
  );

  // Other screens for relation targeting
  const otherScreens = screens.filter((s) => s.id !== screenId);

  if (annotations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No annotations yet. Enable annotation mode and click on the screen to
        add markers.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="flex flex-col gap-1.5 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
          onMouseEnter={() => setHighlightedAnnotationId(ann.id)}
          onMouseLeave={() => setHighlightedAnnotationId(null)}
        >
          <div className="flex items-center gap-2">
            <Badge
              className="h-6 w-6 flex items-center justify-center rounded-full text-xs shrink-0"
              variant={ann.endpointId ? "default" : "secondary"}
            >
              {ann.number}
            </Badge>
            {ann.kind === "rect" ? (
              <Square className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <Select
              value={ann.endpointId ?? "__none__"}
              onValueChange={(v) => linkAnnotation(ann.id, v === "__none__" ? undefined : v)}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Link to endpoint..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unlinked</SelectItem>
                {endpoints.map((ep) => (
                  <SelectItem key={ep.id} value={ep.id}>
                    <span className="font-mono text-xs">
                      {ep.method} {ep.path}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeAnnotation(ann.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Screen relation config */}
          {otherScreens.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
              <Select
                value={ann.screenRelation?.type ?? "__none__"}
                onValueChange={(v) => {
                  if (v === "__none__") {
                    updateAnnotation(ann.id, { screenRelation: undefined });
                  } else {
                    const currentTarget = ann.screenRelation?.targetScreenId ?? otherScreens[0].id;
                    updateAnnotation(ann.id, {
                      screenRelation: { type: v as ScreenRelation["type"], targetScreenId: currentTarget },
                    });
                  }
                }}
              >
                <SelectTrigger className="h-6 text-[10px] w-24">
                  <SelectValue placeholder="Relation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  <SelectItem value="popup_on">Popup on</SelectItem>
                  <SelectItem value="opens_page">Opens page</SelectItem>
                  <SelectItem value="linked_to">Linked to</SelectItem>
                </SelectContent>
              </Select>
              {ann.screenRelation && (
                <Select
                  value={ann.screenRelation.targetScreenId}
                  onValueChange={(v) => {
                    updateAnnotation(ann.id, {
                      screenRelation: { ...ann.screenRelation!, type: ann.screenRelation!.type, targetScreenId: v },
                    });
                  }}
                >
                  <SelectTrigger className="h-6 text-[10px] flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otherScreens.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Textarea
            placeholder="Add a comment..."
            className="h-14 text-xs resize-none"
            defaultValue={ann.comment ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val !== (ann.comment ?? "")) {
                updateAnnotation(ann.id, { comment: val || undefined });
              }
            }}
          />

          {/* Show relation badge if set */}
          {ann.screenRelation && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {RELATION_LABELS[ann.screenRelation.type]}
              </Badge>
              <span className="text-[10px] text-muted-foreground truncate">
                {screens.find((s) => s.id === ann.screenRelation!.targetScreenId)?.name ?? "Unknown"}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
