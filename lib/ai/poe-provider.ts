import type { AIProvider } from "./provider";
import type { AIAnalysisRequest, AIAnalysisResponse } from "@/types";
import { buildAnalysisPrompt } from "./prompts";

export class PoeProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = "Claude-Sonnet-4.5"
  ) {}

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const userContent: unknown[] = [
      {
        type: "text",
        text: buildAnalysisPrompt(
          request.jiraStory,
          request.existingPatterns ?? "",
          request.screenContext
        ),
      },
    ];

    if (request.screenDataUrls?.length) {
      for (const dataUrl of request.screenDataUrls.slice(0, 3)) {
        userContent.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      }
    }

    const res = await fetch("https://api.poe.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: userContent }],
        // stream=false recommended for image inputs
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Poe API error: ${err}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

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
