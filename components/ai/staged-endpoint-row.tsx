"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { EndpointDetail } from "@/components/endpoints/endpoint-detail";
import { EndpointForm } from "@/components/endpoints/endpoint-form";
import type { Endpoint } from "@/types";
import type { StagedEndpoint } from "@/types";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
  POST: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  PATCH: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  DELETE: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  new: { label: "NEW", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
  modified: { label: "MODIFIED", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  unchanged: { label: "UNCHANGED", className: "bg-muted text-muted-foreground" },
  removed: { label: "REMOVED", className: "bg-red-500/20 text-red-700 dark:text-red-400" },
};

interface Props {
  staged: StagedEndpoint;
  index: number;
  onToggle: (index: number) => void;
  onEdit: (index: number, changes: Partial<Endpoint>) => void;
}

export function StagedEndpointRow({ staged, index, onToggle, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { endpoint, status, accepted } = staged;
  const statusStyle = STATUS_STYLES[status];
  const isRemoved = status === "removed";

  return (
    <>
      <div
        className={cn(
          "border rounded-lg overflow-hidden transition-all",
          isRemoved && "opacity-50",
          status === "modified" && "border-yellow-500/40"
        )}
      >
        <div className="flex items-center gap-3 p-2.5">
          <Checkbox
            checked={accepted}
            disabled={isRemoved}
            onCheckedChange={() => onToggle(index)}
          />
          <button
            className={cn(
              "flex items-center gap-2 flex-1 text-left min-w-0",
              isRemoved && "line-through"
            )}
            onClick={() => setExpanded(!expanded)}
          >
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px] font-bold px-1.5 py-0 h-5 border shrink-0",
                METHOD_COLORS[endpoint.method ?? "GET"] ?? ""
              )}
            >
              {endpoint.method ?? "GET"}
            </Badge>
            <code className="text-xs font-mono truncate">{endpoint.path}</code>
            <span className="text-xs text-muted-foreground truncate hidden sm:block">
              {endpoint.description}
            </span>
          </button>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", statusStyle.className)}>
            {statusStyle.label}
          </Badge>
          {!isRemoved && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
        {expanded && (
          <EndpointDetail
            endpoint={{
              id: "",
              method: (endpoint.method as Endpoint["method"]) ?? "GET",
              path: endpoint.path ?? "",
              description: endpoint.description ?? "",
              enabled: true,
              isAiGenerated: true,
              pathParams: endpoint.pathParams ?? [],
              queryParams: endpoint.queryParams ?? [],
              headers: endpoint.headers ?? [],
              linkedScreenIds: endpoint.linkedScreenIds ?? [],
              requestBody: endpoint.requestBody,
              responseBody: endpoint.responseBody,
              notes: endpoint.notes,
            }}
          />
        )}
      </div>

      <EndpointForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={endpoint}
        onSave={(data) => {
          onEdit(index, data);
          setEditOpen(false);
        }}
      />
    </>
  );
}
