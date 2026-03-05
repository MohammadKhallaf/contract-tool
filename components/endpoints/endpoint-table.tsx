"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { EndpointRow } from "./endpoint-row";
import { EndpointForm } from "./endpoint-form";
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);

  // Find endpoint linked to highlighted annotation
  const highlightedEndpointId = highlightedAnnotationId
    ? annotations.find((a) => a.id === highlightedAnnotationId)?.endpointId
    : selectedEndpointId;

  function openAdd() {
    setEditingEndpoint(null);
    setFormOpen(true);
  }

  function openEdit(ep: Endpoint) {
    setEditingEndpoint(ep);
    setFormOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
          {endpoints.filter((e) => !e.enabled).length > 0 &&
            ` (${endpoints.filter((e) => !e.enabled).length} disabled)`}
        </p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Endpoint
        </Button>
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
            />
          ))}
        </div>
      )}

      <EndpointForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingEndpoint(null); }}
        initial={editingEndpoint ?? undefined}
        onSave={(data) => {
          if (editingEndpoint) {
            updateEndpoint(editingEndpoint.id, data);
          } else {
            addEndpoint(data);
          }
        }}
      />
    </div>
  );
}
