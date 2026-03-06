"use client";
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
import type { AIProviderType } from "@/types";

const PROVIDER_MODELS: Record<string, { vision: string[]; text: string[] }> = {
  claude: {
    vision: ["claude-sonnet-4-6", "claude-opus-4-6"],
    text: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"],
  },
  openai: {
    vision: ["gpt-4o", "gpt-4-turbo"],
    text: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  },
  poe: {
    vision: ["Claude-Sonnet-4.5", "Claude-Opus-4.5", "GPT-4o", "Gemini-2.0-Flash"],
    text: ["Claude-Haiku-4.5", "Claude-Sonnet-4.5", "Gemini-2.0-Flash", "Llama-3.1-405B"],
  },
  manual: { vision: [], text: [] },
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
            model: model || textModel || "claude-haiku-4-5-20251001",
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

  const visionModels = PROVIDER_MODELS[aiProvider]?.vision ?? [];
  const textModels = PROVIDER_MODELS[aiProvider]?.text ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>AI Provider</Label>
        <Select
          value={aiProvider}
          onValueChange={(v) => {
            setAiProvider(v as AIProviderType);
            setModel("");
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

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vision Model <span className="normal-case font-normal">(used when screens are attached)</span>
            </p>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select vision model..." />
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
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Text Model <span className="normal-case font-normal">(used when no screens — cheaper)</span>
            </p>
            <Select value={textModel} onValueChange={setTextModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select text model (falls back to vision model)..." />
              </SelectTrigger>
              <SelectContent>
                {textModels.map((m) => (
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
              Recommended: Haiku (10× cheaper than Sonnet, no vision needed for text-only analysis).
            </p>
          </div>

          <Button variant="outline" onClick={testConnection}>
            Test Connection
          </Button>
        </>
      )}
    </div>
  );
}
