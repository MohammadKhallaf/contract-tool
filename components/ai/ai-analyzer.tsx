"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Eye } from "lucide-react";
import { useContractStore } from "@/stores/contract-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpecsStore } from "@/stores/specs-store";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { PoeProvider } from "@/lib/ai/poe-provider";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import { serializeJiraStory } from "@/lib/parsers/jira-parser";
import { toast } from "sonner";
import type { Contract } from "@/types";

function buildPayload(contract: Contract, specs: ReturnType<typeof useSpecsStore.getState>["specs"]) {
  const jiraStory = contract.jiraStories.length > 0
    ? contract.jiraStories.map((s) => serializeJiraStory(s)).join("\n\n---\n\n")
    : "No JIRA stories provided";

  const screenDataUrls = contract.screens.slice(0, 3).map((s) => s.dataUrl);

  const existingPatterns = Object.values(specs)
    .flatMap((spec) => spec.endpoints.slice(0, 5))
    .map((ep) => `${ep.method} ${ep.path}${ep.summary ? ` — ${ep.summary}` : ""}`)
    .join("\n");

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

  const prompt = buildAnalysisPrompt(jiraStory, existingPatterns, screenContext || undefined);

  return { jiraStory, screenDataUrls, existingPatterns, screenContext, prompt };
}

type Step = "idle" | "describing" | "generating" | "done";

const STEP_LABEL: Record<Step, string> = {
  idle: "Analyze with AI",
  describing: "Reading screens…",
  generating: "Generating endpoints…",
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
  const { aiProvider, apiKey, model, textModel } = useSettingsStore();
  const specs = useSpecsStore((s) => s.specs);

  const loading = step === "describing" || step === "generating";
  const payload = contract ? buildPayload(contract, specs) : null;

  async function analyze() {
    if (!contract || !apiKey) {
      toast.error("Configure AI provider and API key in Settings first");
      return;
    }
    if (aiProvider === "manual") {
      toast.error("Select an AI provider in Settings");
      return;
    }

    const { jiraStory, screenDataUrls, existingPatterns, screenContext } = buildPayload(contract, specs);
    const visionModel = model || (aiProvider === "claude" ? "claude-sonnet-4-6" : aiProvider === "openai" ? "gpt-4o" : "Claude-Sonnet-4.5");
    const genModel = textModel || (aiProvider === "claude" ? "claude-haiku-4-5-20251001" : aiProvider === "openai" ? "gpt-4o-mini" : "Claude-Haiku-4.5");

    try {
      let enrichedScreenContext = screenContext;

      // Step 1: vision model describes screens (only if screens exist)
      if (screenDataUrls.length > 0) {
        setStep("describing");
        const visionProvider = makeProvider(aiProvider, apiKey, visionModel);
        if (visionProvider?.describeScreens) {
          const description = await visionProvider.describeScreens(screenDataUrls);
          // Merge AI screen description with manual annotation context
          enrichedScreenContext = screenContext
            ? `${screenContext}\n\nAI Visual Analysis:\n${description}`
            : `AI Visual Analysis:\n${description}`;
        }
      }

      // Step 2: text model generates endpoints from JIRA + screen description
      setStep("generating");
      const genProvider = makeProvider(aiProvider, apiKey, genModel);
      if (!genProvider) return;

      const result = await genProvider.analyze({
        jiraStory,
        screenDataUrls: [], // no images — already described in text
        existingPatterns,
        screenContext: enrichedScreenContext || undefined,
      });

      setStep("done");

      if (result.endpoints.length > 0) {
        addEndpoints(result.endpoints);
        toast.success(
          screenDataUrls.length > 0
            ? `${result.endpoints.length} endpoint(s) added (Sonnet read screens → Haiku generated)`
            : `${result.endpoints.length} endpoint(s) added`
        );
      } else {
        toast.warning("AI returned no endpoints. Check your API key and story.");
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
            : "Step 1: vision model reads screens → Step 2: text model generates endpoints"
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

          {payload && (
            <div className="flex-1 overflow-y-auto space-y-4 text-sm">
              {/* Images summary */}
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Attached Images
                </p>
                {payload.screenDataUrls.length === 0 ? (
                  <p className="text-muted-foreground">No screens uploaded</p>
                ) : (
                  <ul className="space-y-1">
                    {payload.screenDataUrls.map((_, i) => {
                      const screen = contract!.screens[i];
                      return (
                        <li key={i} className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={screen.dataUrl}
                            alt={screen.name}
                            className="h-8 w-12 object-cover rounded border"
                          />
                          <span className="text-muted-foreground">{screen.name}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

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
