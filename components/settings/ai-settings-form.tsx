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

const PROVIDER_MODELS: Record<string, string[]> = {
  claude: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  poe: [
    "Claude-Sonnet-4.5",
    "Claude-Opus-4.5",
    "GPT-4o",
    "Gemini-2.0-Flash",
    "Llama-3.1-405B",
    "Grok-3-Beta",
  ],
  manual: [],
};

const API_KEY_PLACEHOLDERS: Record<string, string> = {
  claude: "sk-ant-...",
  openai: "sk-...",
  poe: "Your Poe API key from poe.com/api/keys",
  manual: "",
};

export function AISettingsForm() {
  const { aiProvider, apiKey, model, setAiProvider, setApiKey, setModel } =
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
            model: model || "claude-haiku-4-5-20251001",
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

  const models = PROVIDER_MODELS[aiProvider] ?? [];

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

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aiProvider === "poe" && (
              <p className="text-xs text-muted-foreground">
                Poe gives access to 100+ models. Enter any bot name manually if not listed.
              </p>
            )}
          </div>

          {aiProvider === "poe" && (
            <div className="space-y-1.5">
              <Label>Custom model name</Label>
              <Input
                placeholder="e.g. Gemini-2.5-Pro or any Poe bot name"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          )}

          <Button variant="outline" onClick={testConnection}>
            Test Connection
          </Button>
        </>
      )}
    </div>
  );
}
