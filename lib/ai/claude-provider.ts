import type { AIProvider } from "./provider";
import type { AIAnalysisRequest, AIAnalysisResponse } from "@/types";
import { buildAnalysisPrompt, buildScreenDescriptionPrompt } from "./prompts";

export class ClaudeProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = "claude-sonnet-4-6"
  ) {}

  async describeScreens(dataUrls: string[]): Promise<string> {
    const content: unknown[] = [
      { type: "text", text: buildScreenDescriptionPrompt() },
    ];
    for (const dataUrl of dataUrls.slice(0, 3)) {
      const [header, data] = dataUrl.split(",");
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: this.model, max_tokens: 1024, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) throw new Error(`Claude screen description error: ${await res.text()}`);
    const data2 = await res.json();
    return data2.content?.[0]?.text ?? "";
  }

  async chat(messages: Array<{ role: string; content: unknown[] }>, maxTokens = 4096): Promise<AIAnalysisResponse> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "";

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? raw);
      return {
        endpoints: parsed.endpoints ?? [],
        reasoning: parsed.reasoning,
        raw,
      };
    } catch {
      return { endpoints: [], reasoning: raw, raw };
    }
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const content: unknown[] = [
      {
        type: "text",
        text: buildAnalysisPrompt(
          request.jiraStory,
          request.existingPatterns ?? "",
          request.screenContext,
          request.stackContext,
          undefined,
          undefined,
          request.patternsContext
        ),
      },
    ];

    // Add screen images if provided
    if (request.screenDataUrls?.length) {
      for (const dataUrl of request.screenDataUrls.slice(0, 3)) {
        const [header, data] = dataUrl.split(",");
        const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
        content.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data },
        });
      }
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "";

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? raw);
      return {
        endpoints: parsed.endpoints ?? [],
        reasoning: parsed.reasoning,
        raw,
      };
    } catch {
      return { endpoints: [], reasoning: raw, raw };
    }
  }
}
