"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ChevronDown, MessageSquare, Trash2, Sparkles } from "lucide-react";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { EndpointRow } from "./endpoint-row";
import { EndpointForm } from "./endpoint-form";
import { toast } from "sonner";
import type { Endpoint } from "@/types";

export function EndpointTable() {
  const endpoints = useContractStore((s) => s.contract?.endpoints ?? []);
  const addEndpoint = useContractStore((s) => s.addEndpoint);
  const updateEndpoint = useContractStore((s) => s.updateEndpoint);
  const toggleEndpoint = useContractStore((s) => s.toggleEndpoint);
  const removeEndpoint = useContractStore((s) => s.removeEndpoint);
  const highlightedAnnotationId = useUIStore((s) => s.highlightedAnnotationId);
  const selectedEndpointId = useUIStore((s) => s.selectedEndpointId);
  const annotations = useContractStore((s) => s.contract?.annotations ?? []);
  const screens = useContractStore((s) => s.contract?.screens ?? []);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [bulkCommentOpen, setBulkCommentOpen] = useState(false);
  const [bulkComment, setBulkComment] = useState("");
  const [bulkTarget, setBulkTarget] = useState<"ai" | "all">("ai");

  // Find endpoint linked to highlighted annotation
  const highlightedEndpointId = highlightedAnnotationId
    ? annotations.find((a) => a.id === highlightedAnnotationId)?.endpointId
    : selectedEndpointId;

  const aiEndpointCount = endpoints.filter((e) => e.isAiGenerated).length;
  const commentCount = endpoints.filter((e) => e.devComment).length;

  function openAdd() {
    setEditingEndpoint(null);
    setFormOpen(true);
  }

  function openEdit(ep: Endpoint) {
    setEditingEndpoint(ep);
    setFormOpen(true);
  }

  function handleClearAllComments() {
    for (const ep of endpoints) {
      if (ep.devComment) {
        updateEndpoint(ep.id, { devComment: undefined });
      }
    }
    setClearConfirmOpen(false);
    toast.success("All comments cleared");
  }

  function handleBulkComment() {
    const comment = bulkComment.trim();
    if (!comment) return;
    const targets = bulkTarget === "ai"
      ? endpoints.filter((e) => e.isAiGenerated)
      : endpoints;
    for (const ep of targets) {
      updateEndpoint(ep.id, { devComment: comment });
    }
    setBulkCommentOpen(false);
    setBulkComment("");
    toast.success(`Comment added to ${targets.length} endpoint(s)`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
          {endpoints.filter((e) => !e.enabled).length > 0 &&
            ` (${endpoints.filter((e) => !e.enabled).length} disabled)`}
        </p>
        <div className="flex items-center gap-2">
          {endpoints.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Bulk Actions
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {aiEndpointCount > 0 && (
                  <DropdownMenuItem onClick={() => { setBulkTarget("ai"); setBulkCommentOpen(true); }}>
                    <Sparkles className="h-3.5 w-3.5 mr-2" />
                    Add comment to AI endpoints ({aiEndpointCount})
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { setBulkTarget("all"); setBulkCommentOpen(true); }}>
                  <MessageSquare className="h-3.5 w-3.5 mr-2" />
                  Add comment to all endpoints
                </DropdownMenuItem>
                {commentCount > 0 && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setClearConfirmOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Clear all comments ({commentCount})
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Endpoint
          </Button>
        </div>
      </div>

      {endpoints.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No endpoints yet.</p>
          <p className="text-xs mt-1">
            Add manually, use AI analysis, or upload Figma screens with annotations.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <EndpointRow
              key={ep.id}
              endpoint={ep}
              isHighlighted={ep.id === highlightedEndpointId}
              onToggle={() => toggleEndpoint(ep.id)}
              onEdit={() => openEdit(ep)}
              onDelete={() => removeEndpoint(ep.id)}
              onComment={(comment) => updateEndpoint(ep.id, { devComment: comment || undefined })}
            />
          ))}
        </div>
      )}

      <EndpointForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingEndpoint(null); }}
        initial={editingEndpoint ?? undefined}
        screens={screens}
        onSave={(data) => {
          if (editingEndpoint) {
            updateEndpoint(editingEndpoint.id, data);
          } else {
            addEndpoint(data);
          }
        }}
      />

      {/* Clear all comments confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all dev comments?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove comments from {commentCount} endpoint{commentCount !== 1 ? "s" : ""}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllComments} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk comment dialog */}
      <Dialog open={bulkCommentOpen} onOpenChange={setBulkCommentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add comment to {bulkTarget === "ai" ? "AI" : "all"} endpoints
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkComment}
              onChange={(e) => setBulkComment(e.target.value)}
              placeholder="e.g. All responses need pagination, add auth headers..."
              className="text-sm min-h-[80px] resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBulkCommentOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleBulkComment} disabled={!bulkComment.trim()}>
                Apply to {bulkTarget === "ai" ? aiEndpointCount : endpoints.length} endpoint{(bulkTarget === "ai" ? aiEndpointCount : endpoints.length) !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
