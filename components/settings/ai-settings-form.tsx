"use client";
import { useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { AIProviderType } from "@/types";

// Vision-capable models shown in the primary picker
const VISION_MODELS: Record<string, string[]> = {
  claude: ["claude-sonnet-4-6", "claude-opus-4-6"],
  openai: ["gpt-4o", "gpt-4-turbo"],
  poe: ["Claude-Sonnet-4.5", "Claude-Opus-4.5", "GPT-4o", "Gemini-2.0-Flash"],
  manual: [],
};

// All models (including cheaper ones) shown in the advanced override picker
const ALL_MODELS: Record<string, string[]> = {
  claude: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  poe: ["Claude-Haiku-4.5", "Claude-Sonnet-4.5", "Gemini-2.0-Flash", "Llama-3.1-405B"],
  manual: [],
};

const API_KEY_PLACEHOLDERS: Record<string, string> = {
  claude: "sk-ant-...",
  openai: "sk-...",
  poe: "Your Poe API key from poe.com/api/keys",
  manual: "",
};

export function AISettingsForm() {
  const { aiProvider, apiKey, model, textModel, setAiProvider, setApiKey, setModel, setTextModel } =
    useSettingsStore();
  const [advancedOpen, setAdvancedOpen] = useState(!!textModel);

  async function testConnection() {
    if (!apiKey) {
      toast.error("Enter an API key first");
      return;
    }
    try {
      if (aiProvider === "claude") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: model || "claude-sonnet-4-6",
            max_tokens: 10,
            messages: [{ role: "user", content: "ping" }],
          }),
        });
        if (res.ok) toast.success("Claude connection successful");
        else toast.error(`Claude error: ${res.statusText}`);
      } else if (aiProvider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) toast.success("OpenAI connection successful");
        else toast.error(`OpenAI error: ${res.statusText}`);
      } else if (aiProvider === "poe") {
        const res = await fetch("https://api.poe.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || "Claude-Sonnet-4.5",
            messages: [{ role: "user", content: "ping" }],
            stream: false,
          }),
        });
        if (res.ok) toast.success("Poe connection successful");
        else toast.error(`Poe error: ${res.statusText}`);
      }
    } catch (e) {
      toast.error(`Connection failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const visionModels = VISION_MODELS[aiProvider] ?? [];
  const allModels = ALL_MODELS[aiProvider] ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>AI Provider</Label>
        <Select
          value={aiProvider}
          onValueChange={(v) => {
            setAiProvider(v as AIProviderType);
            setModel("");
            setTextModel("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude">Claude (Anthropic)</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="poe">Poe (access 100+ models)</SelectItem>
            <SelectItem value="manual">Manual (no AI)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {aiProvider !== "manual" && (
        <>
          <div className="space-y-1.5">
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder={API_KEY_PLACEHOLDERS[aiProvider] ?? ""}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {aiProvider === "poe"
                ? "Get your key at poe.com/api/keys — stored in localStorage only."
                : "Stored in localStorage — never sent to our servers."}
            </p>
          </div>

          {/* Primary model picker */}
          <div className="space-y-1.5">
            <Label>AI Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {visionModels.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aiProvider === "poe" && (
              <Input
                placeholder="Or type any Poe bot name, e.g. Claude-Sonnet-4.5"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Used for screen analysis and endpoint generation.
            </p>
          </div>

          {/* Collapsible advanced section */}
          <div className="rounded-md border">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              <span>Advanced</span>
              {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {advancedOpen && (
              <div className="px-3 pb-3 space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Generation Model Override</Label>
                    {textModel && (
                      <button
                        type="button"
                        onClick={() => setTextModel("")}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Reset
                      </button>
                    )}
                  </div>
                  <Select value={textModel} onValueChange={setTextModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="None (use primary model)" />
                    </SelectTrigger>
                    <SelectContent>
                      {allModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {aiProvider === "poe" && (
                    <Input
                      placeholder="Or type any Poe bot name, e.g. Claude-Haiku-4.5"
                      value={textModel}
                      onChange={(e) => setTextModel(e.target.value)}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Override generation model (optional) — enables 2-step mode where a cheaper model generates
                    endpoints from a text description of screens instead of seeing images directly.{" "}
                    <span className="text-amber-600 dark:text-amber-400">
                      Enabling an override uses a 2-step process to save costs, but may reduce accuracy as the
                      generator only sees a text description of your screens.
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={testConnection}>
            Test Connection
          </Button>
        </>
      )}
    </div>
  );
}
