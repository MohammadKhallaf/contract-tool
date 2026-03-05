"use client";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpecsStore } from "@/stores/specs-store";
import { fetchSpec, getSpecStatus } from "@/lib/specs/spec-fetcher";
import { projectFromUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function SpecManager() {
  const { specUrls, addSpecUrl, removeSpecUrl } = useSettingsStore();
  const { specs, setSpec } = useSpecsStore();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [newUrl, setNewUrl] = useState("");

  async function refreshSpec(url: string) {
    const project = projectFromUrl(url);
    setLoading((l) => ({ ...l, [project]: true }));
    try {
      const spec = await fetchSpec(url);
      setSpec(project, spec);
      toast.success(`${project} loaded — ${spec.endpoints.length} endpoints`);
    } catch (e) {
      toast.error(`Failed to fetch ${project}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading((l) => ({ ...l, [project]: false }));
    }
  }

  async function refreshAll() {
    await Promise.all(specUrls.map((url) => refreshSpec(url)));
  }

  function addUrl() {
    const url = newUrl.trim();
    if (!url) return;
    addSpecUrl(url);
    setNewUrl("");
  }

  function getStatusBadge(url: string) {
    const project = projectFromUrl(url);
    const spec = specs[project];
    const status = getSpecStatus(spec);
    if (status === "cached") {
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] text-green-600 border-green-500">
            cached
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(spec!.fetchedAt), { addSuffix: true })}
          </span>
          <span className="text-xs text-muted-foreground">
            · {spec!.endpoints.length} endpoints
          </span>
        </div>
      );
    }
    if (status === "stale") {
      return (
        <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-500">
          stale
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        not loaded
      </Badge>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={refreshAll} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh All
        </Button>
      </div>

      <div className="space-y-2">
        {specUrls.map((url) => {
          const project = projectFromUrl(url);
          const isLoading = loading[project];
          return (
            <div
              key={url}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium truncate">{project}</p>
                {getStatusBadge(url)}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 shrink-0"
                onClick={() => refreshSpec(url)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeSpecUrl(url)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="https://api.example.com/specs.json?project=..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addUrl()}
          className="text-sm"
        />
        <Button size="icon" variant="outline" onClick={addUrl}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
