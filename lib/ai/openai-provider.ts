import type { AIProvider } from "./provider";
import type { AIAnalysisRequest, AIAnalysisResponse } from "@/types";
import { buildAnalysisPrompt, buildScreenDescriptionPrompt } from "./prompts";

export class OpenAIProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = "gpt-4o"
  ) {}

  async describeScreens(dataUrls: string[]): Promise<string> {
    const content: unknown[] = [
      { type: "text", text: buildScreenDescriptionPrompt() },
      ...dataUrls.slice(0, 3).map((url) => ({
        type: "image_url",
        image_url: { url, detail: "high" },
      })),
    ];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: "user", content }], max_tokens: 1024 }),
    });
    if (!res.ok) throw new Error(`OpenAI screen description error: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const userContent: unknown[] = [
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

    if (request.screenDataUrls?.length) {
      for (const dataUrl of request.screenDataUrls.slice(0, 3)) {
        userContent.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "high" },
        });
      }
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(raw);
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
