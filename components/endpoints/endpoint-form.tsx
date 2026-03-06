"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type { Endpoint, HttpMethod, ParamDefinition, Screen } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (ep: Omit<Endpoint, "id" | "enabled" | "isAiGenerated">) => void;
  initial?: Partial<Endpoint>;
  screens?: Screen[];
}

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function ParamList({
  params,
  onChange,
  label,
}: {
  params: ParamDefinition[];
  onChange: (p: ParamDefinition[]) => void;
  label: string;
}) {
  function add() {
    onChange([...params, { name: "", type: "string", required: false }]);
  }
  function update(i: number, field: keyof ParamDefinition, value: string | boolean) {
    onChange(
      params.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    );
  }
  function remove(i: number) {
    onChange(params.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-6 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {params.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="name"
            value={p.name}
            onChange={(e) => update(i, "name", e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <Input
            placeholder="type"
            value={p.type}
            onChange={(e) => update(i, "type", e.target.value)}
            className="h-8 text-sm w-24"
          />
          <div className="flex items-center gap-1">
            <Switch
              checked={p.required}
              onCheckedChange={(v) => update(i, "required", v)}
            />
            <span className="text-xs text-muted-foreground">req</span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function EndpointForm({ open, onClose, onSave, initial, screens = [] }: Props) {
  const [method, setMethod] = useState<HttpMethod>(initial?.method ?? "GET");
  const [path, setPath] = useState(initial?.path ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pathParams, setPathParams] = useState<ParamDefinition[]>(initial?.pathParams ?? []);
  const [queryParams, setQueryParams] = useState<ParamDefinition[]>(initial?.queryParams ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [reqSchema, setReqSchema] = useState(initial?.requestBody?.schema ?? "");
  const [reqContentType, setReqContentType] = useState(
    initial?.requestBody?.contentType ?? "application/json"
  );
  const [respSchema, setRespSchema] = useState(initial?.responseBody?.schema ?? "");
  const [respStatus, setRespStatus] = useState(
    initial?.responseBody?.statusCode?.toString() ?? "200"
  );
  const [isPaginated, setIsPaginated] = useState(
    initial?.responseBody?.isPaginated ?? false
  );
  const [linkedScreenIds, setLinkedScreenIds] = useState<string[]>(
    initial?.linkedScreenIds ?? []
  );

  function handleSave() {
    onSave({
      method,
      path,
      description,
      pathParams,
      queryParams,
      headers: initial?.headers ?? [],
      linkedScreenIds,
      notes: notes || undefined,
      requestBody: reqSchema
        ? { contentType: reqContentType, schema: reqSchema }
        : undefined,
      responseBody: respSchema
        ? {
            statusCode: parseInt(respStatus, 10) || 200,
            schema: respSchema,
            isPaginated,
          }
        : undefined,
      confidence: initial?.confidence,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Endpoint" : "Add Endpoint"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Path *</Label>
              <Input
                placeholder="/api/resource/{id}"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              placeholder="What does this endpoint do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <ParamList params={pathParams} onChange={setPathParams} label="Path Parameters" />
          <ParamList params={queryParams} onChange={setQueryParams} label="Query Parameters" />

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Request Body
            </Label>
            <Input
              placeholder="Content-Type (application/json)"
              value={reqContentType}
              onChange={(e) => setReqContentType(e.target.value)}
              className="h-8 text-sm"
            />
            <Textarea
              placeholder="Schema definition or shape description..."
              value={reqSchema}
              onChange={(e) => setReqSchema(e.target.value)}
              className="min-h-20 font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Response Body
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Status code (200)"
                value={respStatus}
                onChange={(e) => setRespStatus(e.target.value)}
                className="h-8 text-sm w-32"
              />
              <div className="flex items-center gap-1.5">
                <Switch checked={isPaginated} onCheckedChange={setIsPaginated} />
                <Label className="text-sm font-normal">Paginated</Label>
              </div>
            </div>
            <Textarea
              placeholder="Response schema or shape description..."
              value={respSchema}
              onChange={(e) => setRespSchema(e.target.value)}
              className="min-h-20 font-mono text-sm"
            />
          </div>

          {screens.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Used on Pages
              </Label>
              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                {screens.map((screen) => (
                  <label key={screen.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkedScreenIds.includes(screen.id)}
                      onChange={(e) =>
                        setLinkedScreenIds(
                          e.target.checked
                            ? [...linkedScreenIds, screen.id]
                            : linkedScreenIds.filter((id) => id !== screen.id)
                        )
                      }
                    />
                    {screen.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any important implementation notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!path.trim()}>
              {initial ? "Update" : "Add"} Endpoint
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
