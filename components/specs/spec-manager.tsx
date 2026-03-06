"use client";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpecsStore } from "@/stores/specs-store";
import { fetchSpec, getSpecStatus, isBuiltinUrl } from "@/lib/specs/spec-fetcher";
import { projectFromUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useSettingsStore as useSettings } from "@/stores/settings-store";
import { buildSpecAnalysisPrompt } from "@/lib/ai/prompts";

interface SpecAnalysis {
  paginationShape: { found: boolean; fields: string[]; description: string };
  errorShape: { found: boolean; fields: string[]; description: string };
  namingConventions: { pathPrefix: string; paramStyle: string; notes: string };
  summary: string;
}


export function SpecManager() {
  const { specUrls, addSpecUrl, removeSpecUrl } = useSettingsStore();
  const { specs, setSpec } = useSpecsStore();
  const { aiProvider, apiKey, model } = useSettings();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [analysisResults, setAnalysisResults] = useState<Record<string, SpecAnalysis>>({});
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

  async function analyzeSpec(url: string) {
    const project = projectFromUrl(url);
    const spec = specs[project];

    if (!spec) {
      toast.error("Fetch the spec first before analyzing.");
      return;
    }
    if (aiProvider === "manual" || !apiKey) {
      toast.error("Configure an AI provider and API key in settings first.");
      return;
    }

    setAnalyzing((a) => ({ ...a, [project]: true }));
    try {
      // Build a compact summary of the spec for the AI
      const endpointLines = spec.endpoints.slice(0, 30).map(
        (ep) => `${ep.method} ${ep.path}${ep.summary ? ` — ${ep.summary}` : ""}`
      );
      const schemaLines = spec.schemas.slice(0, 20).map(
        (s) => `${s.name}: { ${Object.keys(s.properties).slice(0, 6).join(", ")} }`
      );
      const specSummary = [
        `Title: ${spec.title ?? project}`,
        `Endpoints (${spec.endpoints.length} total, showing up to 30):`,
        ...endpointLines,
        ``,
        `Schemas (${spec.schemas.length} total, showing up to 20):`,
        ...schemaLines,
      ].join("\n");

      const prompt = buildSpecAnalysisPrompt(specSummary);

      // Use the configured AI provider directly
      const isAnthropic = aiProvider === "claude";
      const endpoint = isAnthropic
        ? "https://api.anthropic.com/v1/messages"
        : "https://api.openai.com/v1/chat/completions";

      let raw = "";
      if (isAnthropic) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: model || "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        raw = data.content?.[0]?.text ?? "";
      } else {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: model || "gpt-4o-mini",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        raw = data.choices?.[0]?.message?.content ?? "";
      }

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const result: SpecAnalysis = JSON.parse(jsonMatch?.[0] ?? raw);
      setAnalysisResults((r) => ({ ...r, [project]: result }));
      toast.success(`Analysis complete for ${project}`);
    } catch (e) {
      toast.error(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAnalyzing((a) => ({ ...a, [project]: false }));
    }
  }

  function addUrl() {
    const url = newUrl.trim();
    if (!url) return;
    if (specUrls.includes(url)) {
      toast.error("This URL is already in the list.");
      return;
    }
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
          const isAnalyzing = analyzing[project];
          const builtin = isBuiltinUrl(url);
          const analysis = analysisResults[project];
          return (
            <div key={url} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-mono font-medium truncate">{project}</p>
                    {builtin && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        built-in
                      </Badge>
                    )}
                  </div>
                  {getStatusBadge(url)}
                </div>

                {/* Analyze button — only for user-added specs */}
                {!builtin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    onClick={() => analyzeSpec(url)}
                    disabled={isAnalyzing || isLoading}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Analyze
                  </Button>
                )}

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
                  disabled={builtin}
                  title={builtin ? "Built-in specs cannot be removed" : "Remove"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Analysis result panel */}
              {analysis && (
                <div className="border-t bg-muted/40 px-3 py-2.5 space-y-1.5 text-xs">
                  <p className="text-muted-foreground">{analysis.summary}</p>
                  {analysis.paginationShape.found && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-medium shrink-0">Pagination:</span>
                      <span className="text-muted-foreground font-mono">
                        {"{ " + analysis.paginationShape.fields.join(", ") + " }"}
                      </span>
                    </div>
                  )}
                  {analysis.errorShape.found && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-medium shrink-0">Errors:</span>
                      <span className="text-muted-foreground font-mono">
                        {"{ " + analysis.errorShape.fields.join(", ") + " }"}
                      </span>
                    </div>
                  )}
                  {analysis.namingConventions.pathPrefix && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-medium shrink-0">Base path:</span>
                      <span className="text-muted-foreground font-mono">
                        {analysis.namingConventions.pathPrefix}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="https://api.example.com/openapi.json"
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
