"use client";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";
import { EndpointDetail } from "./endpoint-detail";
import type { Endpoint } from "@/types";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
  POST: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  PATCH: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  DELETE: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
};

interface Props {
  endpoint: Endpoint;
  isHighlighted: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function EndpointRow({
  endpoint,
  isHighlighted,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        !endpoint.enabled && "opacity-40",
        isHighlighted && "ring-2 ring-orange-400 animate-pulse"
      )}
      id={`endpoint-${endpoint.id}`}
    >
      <div className="flex items-center gap-3 p-3">
        <Switch checked={endpoint.enabled} onCheckedChange={onToggle} />
        <button
          className="flex items-center gap-3 flex-1 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[11px] font-bold px-1.5 py-0 h-5 border",
              METHOD_COLORS[endpoint.method] ?? ""
            )}
          >
            {endpoint.method}
          </Badge>
          <code className="text-sm font-mono flex-1 truncate">{endpoint.path}</code>
          <span className="text-sm text-muted-foreground flex-1 truncate hidden sm:block">
            {endpoint.description}
          </span>
          {endpoint.confidence && (
            <ConfidenceBadge
              level={endpoint.confidence.level}
              score={endpoint.confidence.score}
            />
          )}
          {endpoint.isAiGenerated && (
            <Badge variant="secondary" className="text-[10px]">AI</Badge>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && <EndpointDetail endpoint={endpoint} />}
    </div>
  );
}
