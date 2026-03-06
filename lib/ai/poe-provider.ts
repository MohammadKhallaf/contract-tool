import type { AIProvider } from "./provider";
import type { AIAnalysisRequest, AIAnalysisResponse } from "@/types";
import { buildAnalysisPrompt, buildScreenDescriptionPrompt } from "./prompts";

export class PoeProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = "Claude-Sonnet-4.5"
  ) {}

  private async callPoe(model: string, content: unknown[]): Promise<string> {
    const res = await fetch("https://api.poe.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], stream: false }),
    });
    if (!res.ok) throw new Error(`Poe API error: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  async describeScreens(dataUrls: string[]): Promise<string> {
    const content: unknown[] = [
      { type: "text", text: buildScreenDescriptionPrompt() },
      ...dataUrls.slice(0, 3).map((url) => ({ type: "image_url", image_url: { url } })),
    ];
    return this.callPoe(this.model, content);
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const content: unknown[] = [
      {
        type: "text",
        text: buildAnalysisPrompt(request.jiraStory, request.existingPatterns ?? "", request.screenContext),
      },
    ];
    // fallback: attach images directly if called in single-step mode
    if (request.screenDataUrls?.length) {
      for (const url of request.screenDataUrls.slice(0, 3)) {
        content.push({ type: "image_url", image_url: { url } });
      }
    }
    const raw = await this.callPoe(this.model, content);
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? raw);
      return { endpoints: parsed.endpoints ?? [], reasoning: parsed.reasoning, raw };
    } catch {
      return { endpoints: [], reasoning: raw, raw };
    }
  }
}
