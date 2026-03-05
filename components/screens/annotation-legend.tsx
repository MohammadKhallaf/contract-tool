"use client";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Props {
  screenId: string;
}

export function AnnotationLegend({ screenId }: Props) {
  const annotations = useContractStore(
    (s) => s.contract?.annotations.filter((a) => a.screenId === screenId) ?? []
  );
  const endpoints = useContractStore((s) => s.contract?.endpoints ?? []);
  const linkAnnotation = useContractStore((s) => s.linkAnnotation);
  const removeAnnotation = useContractStore((s) => s.removeAnnotation);
  const setHighlightedAnnotationId = useUIStore(
    (s) => s.setHighlightedAnnotationId
  );

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
          className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
          onMouseEnter={() => setHighlightedAnnotationId(ann.id)}
          onMouseLeave={() => setHighlightedAnnotationId(null)}
        >
          <Badge
            className="h-6 w-6 flex items-center justify-center rounded-full text-xs shrink-0"
            variant={ann.endpointId ? "default" : "secondary"}
          >
            {ann.number}
          </Badge>
          <Select
            value={ann.endpointId ?? ""}
            onValueChange={(v) =>
              linkAnnotation(ann.id, v || undefined)
            }
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Link to endpoint..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unlinked</SelectItem>
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
      ))}
    </div>
  );
}
