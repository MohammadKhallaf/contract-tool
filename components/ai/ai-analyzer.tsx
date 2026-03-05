"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useContractStore } from "@/stores/contract-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpecsStore } from "@/stores/specs-store";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { PoeProvider } from "@/lib/ai/poe-provider";
import { serializeJiraStory } from "@/lib/parsers/jira-parser";
import { toast } from "sonner";

export function AIAnalyzer() {
  const [loading, setLoading] = useState(false);
  const contract = useContractStore((s) => s.contract);
  const addEndpoints = useContractStore((s) => s.addEndpoints);
  const { aiProvider, apiKey, model } = useSettingsStore();
  const specs = useSpecsStore((s) => s.specs);

  async function analyze() {
    if (!contract || !apiKey) {
      toast.error("Configure AI provider and API key in Settings first");
      return;
    }

    const jiraStory = contract.jiraStory
      ? serializeJiraStory(contract.jiraStory)
      : "No JIRA story provided";

    const screenDataUrls = contract.screens.slice(0, 3).map((s) => s.dataUrl);

    const existingPatterns = Object.values(specs)
      .flatMap((spec) => spec.endpoints.slice(0, 5))
      .map((ep) => `${ep.method} ${ep.path}${ep.summary ? ` — ${ep.summary}` : ""}`)
      .join("\n");

    setLoading(true);
    try {
      let provider;
      if (aiProvider === "claude") {
        provider = new ClaudeProvider(apiKey, model || "claude-sonnet-4-6");
      } else if (aiProvider === "openai") {
        provider = new OpenAIProvider(apiKey, model || "gpt-4o");
      } else if (aiProvider === "poe") {
        provider = new PoeProvider(apiKey, model || "Claude-Sonnet-4.5");
      } else {
        toast.error("Select an AI provider in Settings");
        return;
      }

      const result = await provider.analyze({
        jiraStory,
        screenDataUrls,
        existingPatterns,
      });

      if (result.endpoints.length > 0) {
        addEndpoints(result.endpoints);
        toast.success(`${result.endpoints.length} endpoint(s) added from AI analysis`);
      } else {
        toast.warning("AI returned no endpoints. Check your API key and story.");
      }
    } catch (err) {
      toast.error(`AI analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={analyze}
      disabled={loading || aiProvider === "manual" || !apiKey}
      variant="outline"
      className="gap-1.5"
      title={
        aiProvider === "manual" || !apiKey
          ? "Configure AI provider in Settings"
          : "Analyze JIRA story and screens with AI"
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      Analyze with AI
    </Button>
  );
}
