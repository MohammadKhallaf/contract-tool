"use client";
import { useState, useRef, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, MessageSquare, Pencil, Trash2 } from "lucide-react";
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
  onComment: (comment: string) => void;
}

export function EndpointRow({
  endpoint,
  isHighlighted,
  onToggle,
  onEdit,
  onDelete,
  onComment,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState(endpoint.devComment ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasComment = Boolean(endpoint.devComment);

  // Auto-save on blur with debounce
  const handleCommentBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = draft.trim();
      if (trimmed !== (endpoint.devComment ?? "")) {
        onComment(trimmed);
      }
      if (!trimmed) setCommentOpen(false);
    }, 300);
  }, [draft, endpoint.devComment, onComment]);

  // Truncated comment preview (first 60 chars)
  const commentPreview = endpoint.devComment
    ? endpoint.devComment.length > 60
      ? endpoint.devComment.slice(0, 60) + "..."
      : endpoint.devComment
    : null;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        !endpoint.enabled && "opacity-40",
        isHighlighted && "ring-2 ring-orange-400 animate-pulse",
        hasComment && "border-l-2 border-l-amber-400"
      )}
      id={`endpoint-${endpoint.id}`}
    >
      <div className="flex items-center gap-3 p-3">
        <Switch checked={endpoint.enabled} onCheckedChange={onToggle} />
        <button
          className="flex items-center gap-3 flex-1 text-left min-w-0"
          onClick={() => setExpanded(!expanded)}
        >
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[11px] font-bold px-1.5 py-0 h-5 border shrink-0",
              METHOD_COLORS[endpoint.method] ?? ""
            )}
          >
            {endpoint.method}
          </Badge>
          <div className="flex-1 min-w-0">
            <code className="text-sm font-mono truncate block">{endpoint.path}</code>
            {commentPreview && !commentOpen && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 truncate mt-0.5">
                {commentPreview}
              </p>
            )}
          </div>
          <span className={cn("text-sm text-muted-foreground flex-1 hidden sm:block", expanded ? "break-words whitespace-normal" : "truncate")}>
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
          {hasComment && (
            <MessageSquare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-7 w-7", hasComment && "text-amber-500")}
            title="Dev comment (included in next AI analysis)"
            onClick={(e) => { e.stopPropagation(); setCommentOpen((o) => !o); }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
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

      {commentOpen && (
        <div className="border-t bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 space-y-1.5">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            Dev feedback — auto-saves on blur, included in next AI analysis
          </p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleCommentBlur}
            placeholder="e.g. This endpoint needs pagination, response schema is wrong, method should be PATCH..."
            className="text-xs h-16 resize-none"
            autoFocus
          />
        </div>
      )}

      {expanded && <EndpointDetail endpoint={endpoint} />}
    </div>
  );
}
