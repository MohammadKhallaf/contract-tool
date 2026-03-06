"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Eye, Layers, ChevronDown } from "lucide-react";
import { useContractStore } from "@/stores/contract-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpecsStore } from "@/stores/specs-store";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { PoeProvider } from "@/lib/ai/poe-provider";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import { serializeJiraStory } from "@/lib/parsers/jira-parser";
import { generateTypes } from "@/lib/generators/type-generator";
import { generateSchemas } from "@/lib/generators/schema-generator";
import { extractPatterns } from "@/lib/specs/pattern-extractor";
import { PatternPicker } from "@/components/ai/pattern-picker";
import { toast } from "sonner";
import type { Contract } from "@/types";

function buildPayload(
  contract: Contract,
  specs: ReturnType<typeof useSpecsStore.getState>["specs"],
  includeTypesInPrompt: boolean,
  patternSelections: ReturnType<typeof useSettingsStore.getState>["patternSelections"]
) {
  const jiraStory = contract.jiraStories.length > 0
    ? contract.jiraStories.map((s) => serializeJiraStory(s)).join("\n\n---\n\n")
    : "No JIRA stories provided";

  const screenDataUrls = contract.screens.map((s) => s.dataUrl);

  const existingPatterns = Object.values(specs)
    .flatMap((spec) => spec.endpoints.slice(0, 5))
    .map((ep) => `${ep.method} ${ep.path}${ep.summary ? ` — ${ep.summary}` : ""}`)
    .join("\n");

  const allPatterns = extractPatterns(Object.values(specs));
  const patternsContext = allPatterns
    .filter((p) => {
      const sel = patternSelections[p.id];
      return sel ? sel.enabled : p.enabled;
    })
    .map((p) => {
      const sel = patternSelections[p.id];
      const weight = sel ? sel.weight : p.weight;
      return weight < 0.5 ? `(optional) ${p.promptSnippet}` : p.promptSnippet;
    })
    .join("\n") || undefined;

  const screenContext = contract.screens
    .map((sc, idx) => {
      const scAnnotations = contract.annotations.filter((a) => a.screenId === sc.id);
      const lines: string[] = [
        `Screen ${idx + 1} "${sc.name}"${sc.notes ? ` notes: "${sc.notes}"` : ""}`,
      ];
      if (scAnnotations.length > 0) {
        lines.push("  Annotations:");
        for (const ann of scAnnotations) {
          const isRect = ann.kind === "rect";
          const pos = isRect
            ? `[rect ${ann.x.toFixed(0)}%,${ann.y.toFixed(0)}% ${(ann.width ?? 0).toFixed(0)}%×${(ann.height ?? 0).toFixed(0)}%]`
            : `[point at ${ann.x.toFixed(0)}%, ${ann.y.toFixed(0)}%]`;
          const endpoint = ann.endpointId
            ? contract.endpoints.find((e) => e.id === ann.endpointId)
            : null;
          const linked = endpoint ? ` → linked to ${endpoint.method} ${endpoint.path}` : "";
          const comment = ann.comment ? ` — "${ann.comment}"` : "";
          lines.push(`    #${ann.number} ${pos}${linked}${comment}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const stackContext = contract.stack
    ? Object.entries(contract.stack)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : null;

  const typesContext =
    includeTypesInPrompt && contract.generatedTypes.length > 0
      ? `Existing types: ${contract.generatedTypes.map((t) => t.name).join(", ")}`
      : null;

  const schemasContext =
    includeTypesInPrompt && contract.generatedSchemas.length > 0
      ? `Existing schemas: ${contract.generatedSchemas.map((s) => s.name).join(", ")}`
      : null;

  const combinedTypesContext = [typesContext, schemasContext].filter(Boolean).join("\n") || undefined;

  const devFeedback = contract.endpoints
    .filter((ep) => ep.devComment)
    .map((ep) => `  ${ep.method} ${ep.path}: "${ep.devComment}"`)
    .join("\n");

  const prompt = buildAnalysisPrompt(
    jiraStory,
    existingPatterns,
    screenContext || undefined,
    stackContext || undefined,
    combinedTypesContext,
    devFeedback || undefined,
    patternsContext
  );

  return { jiraStory, screenDataUrls, existingPatterns, screenContext, stackContext, devFeedback, patternsContext, allPatterns, prompt };
}

type Step = "idle" | "describing" | "generating" | "loading" | "done";

const STEP_LABEL: Record<Step, string> = {
  idle: "Analyze with AI",
  describing: "Reading screens…",
  generating: "Generating endpoints…",
  loading: "Analyzing…",
  done: "Done",
};

function makeProvider(aiProvider: string, apiKey: string, model: string) {
  if (aiProvider === "claude") return new ClaudeProvider(apiKey, model);
  if (aiProvider === "openai") return new OpenAIProvider(apiKey, model);
  if (aiProvider === "poe") return new PoeProvider(apiKey, model);
  return null;
}

export function AIAnalyzer() {
  const [step, setStep] = useState<Step>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const contract = useContractStore((s) => s.contract);
  const addEndpoints = useContractStore((s) => s.addEndpoints);
  const setGeneratedTypes = useContractStore((s) => s.setGeneratedTypes);
  const setGeneratedSchemas = useContractStore((s) => s.setGeneratedSchemas);
  const { aiProvider, apiKey, model, textModel, includeTypesInPrompt, patternSelections } = useSettingsStore();
  const specs = useSpecsStore((s) => s.specs);
  const [patternPickerOpen, setPatternPickerOpen] = useState(false);

  const loading = step === "describing" || step === "generating" || step === "loading";
  const payload = contract ? buildPayload(contract, specs, includeTypesInPrompt, patternSelections) : null;

  function addEndpointsAndRefresh(eps: Parameters<typeof addEndpoints>[0]) {
    addEndpoints(eps);
    // Read the updated contract immediately (Zustand updates synchronously)
    const updated = useContractStore.getState().contract;
    if (!updated) return;
    const newTypes = generateTypes(updated.endpoints, updated.generatedTypes);
    setGeneratedTypes(newTypes);
    const newSchemas = generateSchemas(newTypes, updated.generatedSchemas);
    setGeneratedSchemas(newSchemas);
  }

  async function analyze() {
    if (!contract || !apiKey) {
      toast.error("Configure AI provider and API key in Settings first");
      return;
    }
    if (aiProvider === "manual") {
      toast.error("Select an AI provider in Settings");
      return;
    }

    const { jiraStory, screenDataUrls, existingPatterns, screenContext, stackContext, patternsContext } = buildPayload(contract, specs, includeTypesInPrompt, patternSelections);
    const primaryModel = model || (aiProvider === "claude" ? "claude-sonnet-4-6" : aiProvider === "openai" ? "gpt-4o" : "Claude-Sonnet-4.5");

    try {
      if (textModel) {
        // 2-step flow: vision model describes screens, text model generates (cost-saving override)
        let enrichedScreenContext = screenContext;

        if (screenDataUrls.length > 0) {
          setStep("describing");
          const visionProvider = makeProvider(aiProvider, apiKey, primaryModel);
          if (visionProvider?.describeScreens) {
            const description = await visionProvider.describeScreens(screenDataUrls);
            enrichedScreenContext = screenContext
              ? `${screenContext}\n\nAI Visual Analysis:\n${description}`
              : `AI Visual Analysis:\n${description}`;
          }
        }

        setStep("generating");
        const genProvider = makeProvider(aiProvider, apiKey, textModel);
        if (!genProvider) return;

        const result = await genProvider.analyze({
          jiraStory,
          screenDataUrls: [], // already described in text
          existingPatterns,
          screenContext: enrichedScreenContext || undefined,
          stackContext: stackContext || undefined,
          patternsContext,
        });

        setStep("done");

        if (result.endpoints.length > 0) {
          addEndpointsAndRefresh(result.endpoints);
          toast.success(
            screenDataUrls.length > 0
              ? `${result.endpoints.length} endpoint(s) added (2-step: vision → text model)`
              : `${result.endpoints.length} endpoint(s) added`
          );
        } else {
          toast.warning("AI returned no endpoints. Check your API key and story.");
        }
      } else {
        // Single-call flow: one model sees everything (default, best quality)
        setStep("loading");
        const provider = makeProvider(aiProvider, apiKey, primaryModel);
        if (!provider) return;

        const result = await provider.analyze({
          jiraStory,
          screenDataUrls,
          existingPatterns,
          screenContext: screenContext || undefined,
          stackContext: stackContext || undefined,
          patternsContext,
        });

        setStep("done");

        if (result.endpoints.length > 0) {
          addEndpointsAndRefresh(result.endpoints);
          toast.success(`${result.endpoints.length} endpoint(s) added`);
        } else {
          toast.warning("AI returned no endpoints. Check your API key and story.");
        }
      }
    } catch (err) {
      toast.error(`AI analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStep("idle");
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => setPreviewOpen(true)}
        disabled={!contract}
        title="Preview what will be sent to the AI"
      >
        <Eye className="h-4 w-4" />
        Preview
      </Button>

      <Button
        onClick={analyze}
        disabled={loading || aiProvider === "manual" || !apiKey}
        variant="outline"
        className="gap-1.5 min-w-[160px]"
        title={
          aiProvider === "manual" || !apiKey
            ? "Configure AI provider in Settings"
            : textModel
            ? "2-step mode: vision model reads screens → text model generates endpoints"
            : "Single-call mode: one model sees images and generates endpoints directly"
        }
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {STEP_LABEL[step]}
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>AI Prompt Preview</DialogTitle>
          </DialogHeader>

          {payload && contract && (
            <div className="flex-1 overflow-y-auto space-y-4 text-sm">
              {/* Images summary */}
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Attached Images ({payload.screenDataUrls.length})
                </p>
                {payload.screenDataUrls.length === 0 ? (
                  <p className="text-muted-foreground">No screens uploaded</p>
                ) : (
                  <ul className="space-y-1">
                    {contract.screens.map((screen) => (
                      <li key={screen.id} className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screen.dataUrl}
                          alt={screen.name}
                          className="h-8 w-12 object-cover rounded border"
                        />
                        <span className="text-muted-foreground">{screen.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Tech stack */}
              {payload.stackContext && (
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tech Stack
                  </p>
                  <p className="text-xs text-foreground">{payload.stackContext}</p>
                </div>
              )}

              {/* Spec patterns */}
              <div className="rounded-md border p-3 space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setPatternPickerOpen((o) => !o)}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    Spec Patterns
                    {payload.allPatterns.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal normal-case tracking-normal">
                        {payload.allPatterns.filter((p) => {
                          const sel = patternSelections[p.id];
                          return sel ? sel.enabled : p.enabled;
                        }).length} / {payload.allPatterns.length}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${patternPickerOpen ? "rotate-180" : ""}`} />
                </button>
                {patternPickerOpen && <PatternPicker />}
              </div>

              {/* Dev feedback */}
              {payload.devFeedback && (
                <div className="rounded-md border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Developer Feedback (regression context)
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                    {payload.devFeedback}
                  </pre>
                </div>
              )}

              {/* Full prompt text */}
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt Text
                </p>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                  {payload.prompt}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
