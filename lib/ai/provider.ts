import type { AIAnalysisRequest, AIAnalysisResponse } from "@/types";

export interface AIProvider {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  describeScreens?(dataUrls: string[]): Promise<string>;
}
